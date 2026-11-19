import "server-only";

import type postgres from "postgres";

// A small query builder over plain Postgres. It keeps the chainable style the
// CRM was written in — db.from("leads").select("*").eq("org_id", id) — and
// returns `{ data, error, count }` instead of throwing. Results are built as
// jsonb inside Postgres, so numbers, timestamps (ISO strings) and arrays come
// back as plain JSON values.
//
// Supported: select (columns, `*`, `alias:column`, related rows such as
// `organizations(name)`, `profiles:user_id(full_name)`, `workflow_steps(*)`),
// insert, update, upsert (onConflict, ignoreDuplicates), delete, rpc;
// filters eq, neq, gt, gte, lt, lte, like, ilike, is, in, cs, cd, not, or,
// match, filter; order, limit, range, single, maybeSingle, count.

export type Sql = postgres.Sql;

/** Who the queries run as: a signed-in user or anonymous visitor (Row Level Security applies), or the server itself. */
export type DbRole = { kind: "user"; userId: string } | { kind: "anon" } | { kind: "server" };

export interface DbError {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}

// The builder is used from untyped code paths (as the Supabase client was), so
// rows are `any`; callers narrow them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export interface DbResult<T = Row> {
  data: T;
  error: DbError | null;
  count: number | null;
}

// --- Schema metadata (columns, keys, relationships), loaded once -------------

interface Meta {
  columns: Map<string, Map<string, string>>; // table → column → SQL type
  primaryKeys: Map<string, string[]>;
  foreignKeys: { table: string; column: string; refTable: string; refColumn: string }[];
}

let metaPromise: Promise<Meta> | null = null;

function loadMeta(sql: Sql): Promise<Meta> {
  metaPromise ??= (async () => {
    const [cols, pks, fks] = await Promise.all([
      sql<{ table: string; column: string; type: string }[]>`
        select c.relname as table, a.attname as column, format_type(a.atttypid, a.atttypmod) as type
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'v', 'p') and a.attnum > 0 and not a.attisdropped`,
      sql<{ table: string; column: string }[]>`
        select c.relname as table, a.attname as column
        from pg_index i
        join pg_class c on c.oid = i.indrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attnum = any (i.indkey)
        where n.nspname = 'public' and i.indisprimary`,
      sql<{ table: string; column: string; ref_table: string; ref_column: string }[]>`
        select cl.relname as table, att.attname as column, fcl.relname as ref_table, fatt.attname as ref_column
        from pg_constraint con
        join pg_class cl on cl.oid = con.conrelid
        join pg_namespace n on n.oid = cl.relnamespace
        join pg_class fcl on fcl.oid = con.confrelid
        join pg_namespace fn on fn.oid = fcl.relnamespace
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
        join pg_attribute fatt on fatt.attrelid = con.confrelid and fatt.attnum = con.confkey[1]
        where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public' and array_length(con.conkey, 1) = 1`,
    ]);
    const columns = new Map<string, Map<string, string>>();
    for (const c of cols) {
      if (!columns.has(c.table)) columns.set(c.table, new Map());
      columns.get(c.table)!.set(c.column, c.type);
    }
    const primaryKeys = new Map<string, string[]>();
    for (const p of pks) primaryKeys.set(p.table, [...(primaryKeys.get(p.table) ?? []), p.column]);
    return {
      columns,
      primaryKeys,
      foreignKeys: fks.map((f) => ({ table: f.table, column: f.column, refTable: f.ref_table, refColumn: f.ref_column })),
    };
  })().catch((error) => {
    metaPromise = null;
    throw error;
  });
  return metaPromise;
}

// --- Helpers ---------------------------------------------------------------

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

class QueryError extends Error {
  constructor(
    message: string,
    public code = "PGRST100",
  ) {
    super(message);
  }
}

function columnType(meta: Meta, table: string, column: string) {
  const type = meta.columns.get(table)?.get(column);
  if (!type) throw new QueryError(`Column "${column}" does not exist on "${table}"`, "42703");
  return type;
}

function arrayLiteral(values: unknown[]): string {
  return `{${values
    .map((v) => (v === null || v === undefined ? "NULL" : `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`))
    .join(",")}}`;
}

/** Encodes a JS value as a text parameter for a column of the given SQL type. */
function encode(value: unknown, type: string): string | null {
  if (value === null || value === undefined) return null;
  if (type === "jsonb" || type === "json") return JSON.stringify(value);
  if (type.endsWith("[]")) return Array.isArray(value) ? arrayLiteral(value) : String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

class Params {
  values: (string | null)[] = [];
  add(value: string | null, type?: string) {
    this.values.push(value);
    return type ? `$${this.values.length}::${type}` : `$${this.values.length}`;
  }
}

// --- select parsing --------------------------------------------------------

type SelectItem =
  | { kind: "star" }
  | { kind: "column"; name: string; alias: string }
  | { kind: "embed"; name: string; hint: string | null; alias: string; items: SelectItem[] };

function splitTopLevel(input: string, separator = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSelect(input: string): SelectItem[] {
  return splitTopLevel(input.replace(/\s+/g, " ")).map((raw): SelectItem => {
    if (raw === "*") return { kind: "star" };
    const paren = raw.indexOf("(");
    const head = paren === -1 ? raw : raw.slice(0, paren);
    const colon = head.indexOf(":");
    const alias = colon === -1 ? null : head.slice(0, colon).trim();
    const rest = (colon === -1 ? head : head.slice(colon + 1)).trim();
    if (paren === -1) return { kind: "column", name: rest, alias: alias ?? rest };
    if (!raw.endsWith(")")) throw new QueryError(`Malformed select: ${raw}`);
    const [name, hint] = rest.split("!").map((s) => s.trim());
    return { kind: "embed", name: name!, hint: hint ?? null, alias: alias ?? name!, items: parseSelect(raw.slice(paren + 1, -1)) };
  });
}

let aliasCounter = 0;

/** A jsonb expression for one row of `table` (aliased `alias`), including related rows. */
function rowExpression(meta: Meta, table: string, alias: string, items: SelectItem[]): string {
  const parts: string[] = [];
  const pairs: string[] = [];
  for (const item of items) {
    if (item.kind === "star") parts.push(`to_jsonb(${alias})`);
    else if (item.kind === "column") {
      columnType(meta, table, item.name);
      pairs.push(`'${item.alias.replace(/'/g, "''")}', ${alias}.${ident(item.name)}`);
    } else pairs.push(`'${item.alias.replace(/'/g, "''")}', ${embedExpression(meta, table, alias, item)}`);
  }
  // jsonb_build_object takes at most 100 arguments; build in chunks.
  for (let i = 0; i < pairs.length; i += 40) parts.push(`jsonb_build_object(${pairs.slice(i, i + 40).join(", ")})`);
  return parts.length ? parts.join(" || ") : "'{}'::jsonb";
}

function embedExpression(meta: Meta, table: string, alias: string, item: Extract<SelectItem, { kind: "embed" }>): string {
  const inner = `e${++aliasCounter}`;
  const fks = meta.foreignKeys;

  // `alias:fk_column(...)` or `table!fk_column(...)` → the row that column points at.
  const viaColumn = fks.find((f) => f.table === table && f.column === item.name) ?? (item.hint ? fks.find((f) => f.table === table && f.column === item.hint && f.refTable === item.name) : undefined);
  const manyToOne = viaColumn ?? fks.find((f) => f.table === table && f.refTable === item.name);
  if (manyToOne) {
    const target = manyToOne.refTable;
    return `(select ${rowExpression(meta, target, inner, item.items)} from public.${ident(target)} ${inner} where ${inner}.${ident(manyToOne.refColumn)} = ${alias}.${ident(manyToOne.column)} limit 1)`;
  }

  const oneToMany = fks.find((f) => f.table === item.name && f.refTable === table && (!item.hint || f.column === item.hint));
  if (oneToMany) {
    return `(select coalesce(jsonb_agg(${rowExpression(meta, item.name, inner, item.items)}), '[]'::jsonb) from public.${ident(item.name)} ${inner} where ${inner}.${ident(oneToMany.column)} = ${alias}.${ident(oneToMany.refColumn)})`;
  }
  throw new QueryError(`Could not find a relationship between "${table}" and "${item.name}"`, "PGRST200");
}

// --- filters -----------------------------------------------------------------

type Filter = (meta: Meta, params: Params, alias: string, table: string) => string;

const OPERATORS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", cs: "@>", cd: "<@", ov: "&&" };

function condition(column: string, operator: string, value: unknown): Filter {
  return (meta, params, alias, table) => {
    const type = columnType(meta, table, column);
    const col = `${alias}.${ident(column)}`;
    switch (operator) {
      case "is": {
        const v = value === null || value === "null" ? "null" : value === true || value === "true" ? "true" : value === false || value === "false" ? "false" : null;
        if (!v) throw new QueryError(`Invalid "is" value: ${String(value)}`);
        return `${col} is ${v}`;
      }
      case "in": {
        const list = Array.isArray(value)
          ? value
          : String(value)
              .replace(/^\(|\)$/g, "")
              .split(",")
              .map((s) => s.trim().replace(/^"(.*)"$/, "$1"))
              .filter((s) => s !== "");
        if (!list.length) return "false";
        return `${col} in (${list.map((v) => params.add(encode(v, type), type)).join(", ")})`;
      }
      case "like":
      case "ilike":
        return `${col}::text ${operator} ${params.add(String(value).replace(/\*/g, "%"))}`;
      default: {
        const op = OPERATORS[operator];
        if (!op) throw new QueryError(`Unsupported operator: ${operator}`);
        return `${col} ${op} ${params.add(encode(value, type), type)}`;
      }
    }
  };
}

/** Parses a PostgREST-style logic string, e.g. "phone.not.is.null,email.eq.a@b.c". */
function parseLogic(input: string): Filter[] {
  return splitTopLevel(input).map((part): Filter => {
    const group = part.match(/^(not\.)?(and|or)\((.*)\)$/);
    if (group) {
      const children = parseLogic(group[3]!);
      const joiner = group[2] === "and" ? " and " : " or ";
      return (meta, params, alias, table) => `${group[1] ? "not " : ""}(${children.map((f) => f(meta, params, alias, table)).join(joiner)})`;
    }
    const match = part.match(/^([a-zA-Z0-9_]+)\.(not\.)?([a-z]+)\.(.*)$/);
    if (!match) throw new QueryError(`Malformed filter: ${part}`);
    const [, column, negate, operator, value] = match;
    const inner = condition(column!, operator!, value);
    return negate ? (meta, params, alias, table) => `not (${inner(meta, params, alias, table)})` : inner;
  });
}

// --- execution -------------------------------------------------------------

async function run(sql: Sql, role: DbRole, text: string, params: (string | null)[]) {
  return sql.begin(async (tx) => {
    if (role.kind !== "server") {
      await tx.unsafe(`select set_config('role', $1, true), set_config('app.user_id', $2, true)`, [
        role.kind === "user" ? "authenticated" : "anon",
        role.kind === "user" ? role.userId : "",
      ]);
    }
    return tx.unsafe(text, params);
  });
}

function toError(error: unknown): DbError {
  const e = error as { message?: string; code?: string; detail?: string; hint?: string };
  return { message: e?.message ?? String(error), code: e?.code ?? "XX000", details: e?.detail, hint: e?.hint };
}

type Mode = "select" | "insert" | "update" | "upsert" | "delete";

export class QueryBuilder<T = Row> implements PromiseLike<DbResult<T>> {
  private mode: Mode = "select";
  private columns: string | null = null;
  private returning = false;
  private countMode = false;
  private head = false;
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  private limitCount: number | null = null;
  private offsetCount: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private values: Record<string, unknown>[] = [];
  private onConflict: string[] | null = null;
  private ignoreDuplicates = false;

  constructor(
    private sql: Sql,
    private role: DbRole,
    private table: string,
  ) {}

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): QueryBuilder<T> {
    if (this.mode === "select") {
      this.columns = columns;
      this.countMode = options?.count === "exact";
      this.head = Boolean(options?.head);
    } else {
      this.columns = columns;
      this.returning = true;
    }
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.mode = "insert";
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert";
    this.values = Array.isArray(values) ? values : [values];
    this.onConflict = options?.onConflict ? options.onConflict.split(",").map((c) => c.trim()) : null;
    this.ignoreDuplicates = Boolean(options?.ignoreDuplicates);
    return this;
  }

  update(values: Record<string, unknown>) {
    this.mode = "update";
    this.values = [values];
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push(condition(column, "eq", value));
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push(condition(column, "neq", value));
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push(condition(column, "gt", value));
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push(condition(column, "gte", value));
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push(condition(column, "lt", value));
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push(condition(column, "lte", value));
    return this;
  }
  like(column: string, pattern: string) {
    this.filters.push(condition(column, "like", pattern));
    return this;
  }
  ilike(column: string, pattern: string) {
    this.filters.push(condition(column, "ilike", pattern));
    return this;
  }
  is(column: string, value: null | boolean) {
    this.filters.push(condition(column, "is", value));
    return this;
  }
  in(column: string, values: readonly unknown[]) {
    this.filters.push(condition(column, "in", [...values]));
    return this;
  }
  contains(column: string, value: unknown) {
    this.filters.push(condition(column, "cs", value));
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    const inner = condition(column, operator, value);
    this.filters.push((meta, params, alias, table) => `not (${inner(meta, params, alias, table)})`);
    return this;
  }
  filter(column: string, operator: string, value: unknown) {
    if (operator.startsWith("not.")) return this.not(column, operator.slice(4), value);
    this.filters.push(condition(column, operator, value));
    return this;
  }
  or(logic: string) {
    const parts = parseLogic(logic);
    this.filters.push((meta, params, alias, table) => `(${parts.map((f) => f(meta, params, alias, table)).join(" or ")})`);
    return this;
  }
  match(query: Record<string, unknown>) {
    for (const [column, value] of Object.entries(query)) this.eq(column, value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true, nullsFirst: options?.nullsFirst });
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }
  single(): QueryBuilder<T> {
    this.singleMode = "single";
    return this;
  }
  maybeSingle(): QueryBuilder<T> {
    this.singleMode = "maybeSingle";
    return this;
  }

  then<R1 = DbResult<T>, R2 = never>(onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null, onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private where(meta: Meta, params: Params, alias: string) {
    if (!this.filters.length) return "";
    return ` where ${this.filters.map((f) => `(${f(meta, params, alias, this.table)})`).join(" and ")}`;
  }

  private tail(meta: Meta) {
    let out = "";
    if (this.orders.length) {
      out += ` order by ${this.orders
        .map((o) => {
          columnType(meta, this.table, o.column);
          const nulls = o.nullsFirst === undefined ? "" : o.nullsFirst ? " nulls first" : " nulls last";
          return `t0.${ident(o.column)} ${o.ascending ? "asc" : "desc"}${nulls}`;
        })
        .join(", ")}`;
    }
    if (this.limitCount !== null) out += ` limit ${Math.max(0, Math.floor(this.limitCount))}`;
    if (this.offsetCount !== null) out += ` offset ${Math.max(0, Math.floor(this.offsetCount))}`;
    return out;
  }

  private async execute(): Promise<DbResult<T>> {
    try {
      const meta = await loadMeta(this.sql);
      if (!meta.columns.has(this.table)) throw new QueryError(`Relation "${this.table}" does not exist`, "42P01");
      const params = new Params();
      const target = `public.${ident(this.table)}`;
      let text: string;

      if (this.mode === "select") {
        if (this.head) {
          text = `select count(*)::int as count from ${target} t0${this.where(meta, params, "t0")}`;
          const rows = await run(this.sql, this.role, text, params.values);
          return { data: null as T, error: null, count: (rows[0]?.count as number) ?? 0 };
        }
        const projection = rowExpression(meta, this.table, "t0", parseSelect(this.columns ?? "*"));
        text = `select ${projection} as r from ${target} t0${this.where(meta, params, "t0")}${this.tail(meta)}`;
      } else {
        const projection = this.returning ? rowExpression(meta, this.table, "t0", parseSelect(this.columns ?? "*")) : "null::jsonb";
        let statement: string;

        if (this.mode === "insert" || this.mode === "upsert") {
          if (!this.values.length) return { data: (this.returning ? [] : null) as T, error: null, count: null };
          const keys = [...new Set(this.values.flatMap((row) => Object.keys(row).filter((k) => row[k] !== undefined)))];
          const types = keys.map((k) => columnType(meta, this.table, k));
          const rows = this.values.map(
            (row) => `(${keys.map((k, i) => (row[k] === undefined ? "default" : params.add(encode(row[k], types[i]!), types[i]))).join(", ")})`,
          );
          statement = `insert into ${target} (${keys.map(ident).join(", ")}) values ${rows.join(", ")}`;
          if (this.mode === "upsert") {
            const conflict = this.onConflict ?? meta.primaryKeys.get(this.table) ?? [];
            if (!conflict.length) throw new QueryError(`No conflict target for upsert into "${this.table}"`);
            const updates = keys.filter((k) => !conflict.includes(k));
            statement +=
              this.ignoreDuplicates || !updates.length
                ? ` on conflict (${conflict.map(ident).join(", ")}) do nothing`
                : ` on conflict (${conflict.map(ident).join(", ")}) do update set ${updates.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(", ")}`;
          }
          statement += " returning *";
        } else if (this.mode === "update") {
          const entries = Object.entries(this.values[0] ?? {}).filter(([, v]) => v !== undefined);
          if (!entries.length) throw new QueryError("Nothing to update");
          const sets = entries.map(([k, v]) => {
            const type = columnType(meta, this.table, k);
            return `${ident(k)} = ${params.add(encode(v, type), type)}`;
          });
          statement = `update ${target} t0 set ${sets.join(", ")}${this.where(meta, params, "t0")} returning t0.*`;
        } else {
          statement = `delete from ${target} t0${this.where(meta, params, "t0")} returning t0.*`;
        }
        text = `with t0 as (${statement}) select ${projection} as r from t0`;
      }

      const rows = await run(this.sql, this.role, text, params.values);
      if (this.mode !== "select" && !this.returning && !this.singleMode) return { data: null as T, error: null, count: null };
      const data = rows.map((row) => row.r);

      if (this.singleMode) {
        if (data.length === 1) return { data: data[0] as T, error: null, count: null };
        if (data.length === 0 && this.singleMode === "maybeSingle") return { data: null as T, error: null, count: null };
        return {
          data: null as T,
          error: { message: `JSON object requested, multiple (or no) rows returned (${data.length} rows)`, code: "PGRST116" },
          count: null,
        };
      }

      let count: number | null = null;
      if (this.countMode) {
        const countParams = new Params();
        const counted = await run(this.sql, this.role, `select count(*)::int as count from ${target} t0${this.where(meta, countParams, "t0")}`, countParams.values);
        count = (counted[0]?.count as number) ?? 0;
      }
      return { data: data as T, error: null, count };
    } catch (error) {
      return { data: null as T, error: toError(error), count: null };
    }
  }
}

/** Calls a SQL function: db.rpc("create_organization", { org_name, org_slug }). */
export async function callFunction(sql: Sql, role: DbRole, name: string, args: Record<string, unknown> = {}): Promise<DbResult> {
  try {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new QueryError(`Invalid function name: ${name}`);
    const params = new Params();
    const list = Object.entries(args).map(([k, v]) => {
      if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new QueryError(`Invalid argument name: ${k}`);
      return `${k} => ${params.add(v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v))}`;
    });
    const rows = await run(sql, role, `select public.${ident(name)}(${list.join(", ")}) as r`, params.values);
    const column = rows.columns?.[0];
    const isVoid = column?.type === 2278;
    return { data: isVoid ? null : (rows[0]?.r ?? null), error: null, count: null };
  } catch (error) {
    return { data: null, error: toError(error), count: null };
  }
}
