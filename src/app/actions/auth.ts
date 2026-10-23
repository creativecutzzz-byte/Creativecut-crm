"use server";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

export interface AuthState {
  error?: string;
  message?: string;
}

const credentials = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  // Only allow same-site relative redirects.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) redirect("/dashboard");

  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: error.message };

  redirect(safeNext(parsed.data.next));
}

export async function sendMagicLink(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) redirect("/dashboard");

  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email" };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: false },
  });
  if (error) return { error: error.message };
  return { message: "Check your inbox for a sign-in link." };
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) redirect("/dashboard");

  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };

  // With email confirmation on, there's no session until the link is clicked.
  if (!data.session) return { message: "Check your inbox to confirm your email, then sign in." };
  redirect("/dashboard");
}

const workspaceSchema = z.object({ name: z.string().trim().min(2, "Name your workspace").max(80) });

/** Creates a workspace owned by the signed-in user (seeded with starter templates and workflows). */
export async function createWorkspace(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = workspaceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!isSupabaseConfigured) return { error: "Supabase isn't configured." };

  const supabase = await createClient();
  const slug = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace"}-${crypto.randomUUID().slice(0, 6)}`;
  const { error } = await supabase.rpc("create_organization", { org_name: parsed.data.name, org_slug: slug });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
