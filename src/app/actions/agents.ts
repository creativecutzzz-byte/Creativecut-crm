"use server";

import { requireWorkspace, type ActionState } from "@/lib/actions";
import { getAgentDefinition } from "@/lib/agents/registry";
import { runAgent } from "@/lib/agents/runner";
import { revalidatePath } from "next/cache";

const ADMIN = ["owner", "admin"] as const;

export async function setAgentEnabled(key: string, enabled: boolean): Promise<ActionState> {
  if (!getAgentDefinition(key)) return { error: "Unknown agent" };
  const ws = await requireWorkspace([...ADMIN]);
  if ("error" in ws) return ws;
  const { error } = await ws.supabase.from("agents").upsert({ org_id: ws.viewer.orgId, key, enabled }, { onConflict: "org_id,key" });
  if (error) return { error: error.message };
  revalidatePath("/agents");
  return { ok: true, message: enabled ? "Agent switched on — it runs every morning" : "Agent switched off" };
}

export async function saveAgentConfig(_: ActionState, formData: FormData): Promise<ActionState> {
  const key = String(formData.get("key") ?? "");
  const def = getAgentDefinition(key);
  if (!def) return { error: "Unknown agent" };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("config") ?? "{}"));
  } catch {
    return { error: "Settings must be valid JSON." };
  }
  const parsed = def.configSchema.safeParse({ ...def.defaultConfig, ...(raw as object) });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue?.path.join(".") || "settings"}: ${issue?.message ?? "invalid"}` };
  }

  const ws = await requireWorkspace([...ADMIN]);
  if ("error" in ws) return ws;
  const { data: row } = await ws.supabase.from("agents").select("config").eq("org_id", ws.viewer.orgId).eq("key", key).maybeSingle();
  const state = (row?.config as { state?: unknown } | null)?.state;
  const { error } = await ws.supabase
    .from("agents")
    .upsert({ org_id: ws.viewer.orgId, key, config: { ...(parsed.data as object), ...(state ? { state } : {}) } }, { onConflict: "org_id,key" });
  if (error) return { error: error.message };
  revalidatePath("/agents");
  return { ok: true, message: "Settings saved" };
}

export async function runAgentNow(key: string): Promise<ActionState> {
  if (!getAgentDefinition(key)) return { error: "Unknown agent" };
  const ws = await requireWorkspace([...ADMIN]);
  if ("error" in ws) return ws;
  const outcome = await runAgent(ws.supabase, ws.viewer.orgId, key, "manual", ws.viewer.userId);
  revalidatePath("/agents");
  revalidatePath("/leads");
  if (outcome.status === "error") return { error: outcome.summary };
  return { ok: true, message: outcome.summary };
}
