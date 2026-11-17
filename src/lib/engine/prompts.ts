import { readText } from "./config";

// Prompts live in docs/prompts/*.md so they can be tuned without touching code.
// Everything above "---INPUT---" is the stable system prompt (cached); the rest
// is the per-lead input. {placeholders} are filled from `vars`.

const cache = new Map<string, { system: string; input: string }>();

export function fill(template: string, vars: Record<string, string | number | null | undefined>) {
  return template.replace(/\{([a-z_]+)\}/g, (m, key: string) => (key in vars ? String(vars[key] ?? "") : m));
}

export function prompt(name: string, vars: Record<string, string | number | null | undefined>) {
  if (!cache.has(name)) {
    const [system, input = ""] = readText(`docs/prompts/${name}.md`).split(/^---INPUT---$/m);
    cache.set(name, { system: system!.trim(), input: input.trim() });
  }
  const t = cache.get(name)!;
  return { system: fill(t.system, vars), input: fill(t.input, vars) };
}
