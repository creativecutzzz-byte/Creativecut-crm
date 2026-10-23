import "server-only";

import { getViewer, type Viewer } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/types";
import { z } from "zod";

/** Result shape shared by every form-backed server action. */
export interface ActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export const DEMO_ERROR = "Demo mode — connect Supabase (see README) to save changes.";

/** Empty form fields become null. */
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);

export const optionalEmail = z
  .union([z.literal(""), z.email("Invalid email")])
  .optional()
  .transform((v) => v || null);

/** `<input type="datetime-local">` / `<input type="date">` value → ISO string, or null when empty. */
export const optionalDateTime = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const date = new Date(v);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
      return z.NEVER;
    }
    return date.toISOString();
  });

export const optionalUuid = z
  .union([z.literal(""), z.uuid()])
  .optional()
  .transform((v) => v || null);

type Workspace = { viewer: Viewer & { orgId: string; userId: string }; supabase: Awaited<ReturnType<typeof createClient>> };

/**
 * Resolves the signed-in member and a Supabase client, or an error message
 * suitable for returning from an action. Optionally requires one of `roles`.
 */
export async function requireWorkspace(roles?: MemberRole[]): Promise<Workspace | { error: string }> {
  if (!isSupabaseConfigured) return { error: DEMO_ERROR };
  const viewer = await getViewer();
  if (!viewer.userId) return { error: "Your session expired — sign in again." };
  if (!viewer.orgId) return { error: "You're not part of a workspace." };
  if (roles && !roles.includes(viewer.role)) return { error: "You don't have permission to do that." };
  return { viewer: viewer as Workspace["viewer"], supabase: await createClient() };
}

/** First validation message from a failed zod parse. */
export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Invalid input";
}
