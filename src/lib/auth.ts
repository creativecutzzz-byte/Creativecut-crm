import "server-only";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { isDatabaseConfigured } from "@/lib/env";

// Email + password accounts with server-side sessions. The browser only holds
// a random session token in an HttpOnly cookie; the database stores its
// SHA-256 hash, so a leaked database can't be used to sign in. Passwords are
// bcrypt hashes (the same format Supabase used, so imported accounts keep
// their passwords).

export const SESSION_COOKIE = "cc_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function sql() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
}

/** The signed-in user for this request, or null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isDatabaseConfigured) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await sql();
  const [row] = await db<{ id: string; email: string; full_name: string | null }[]>`
    select u.id, u.email, u.raw_user_meta_data ->> 'full_name' as full_name
    from auth.sessions s
    join auth.users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()`;
  return row ? { id: row.id, email: row.email, fullName: row.full_name ?? "" } : null;
});

export async function getSessionUserId() {
  return (await getSessionUser())?.id ?? null;
}

async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const db = await sql();
  await db`insert into auth.sessions (user_id, token_hash, expires_at) values (${userId}, ${hashToken(token)}, ${expires})`;
  await db`update auth.users set last_sign_in_at = now() where id = ${userId}`;
  // Housekeeping: drop this user's expired sessions.
  await db`delete from auth.sessions where user_id = ${userId} and expires_at < now()`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Checks the password and starts a session. Returns false for an unknown email or wrong password. */
export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const db = await sql();
  const [user] = await db<{ id: string; encrypted_password: string }[]>`
    select id, encrypted_password from auth.users where lower(email) = lower(${email.trim()})`;
  // Compare against a dummy hash for unknown emails so response time doesn't reveal which emails exist.
  const ok = await bcrypt.compare(password, user?.encrypted_password ?? "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.8wY1rQbuTnU2N1Vf1QfHgg5u6v3e");
  if (!user || !ok) return false;
  await startSession(user.id);
  return true;
}

/** Creates an account and signs it in. Returns "exists" when the email is already registered. */
export async function signUpWithPassword(email: string, password: string, fullName: string): Promise<"ok" | "exists"> {
  const db = await sql();
  const hash = await bcrypt.hash(password, 10);
  const [user] = await db<{ id: string }[]>`
    insert into auth.users (email, encrypted_password, raw_user_meta_data)
    values (${email.trim().toLowerCase()}, ${hash}, ${db.json({ full_name: fullName })})
    on conflict ((lower(email))) do nothing
    returning id`;
  if (!user) return "exists";
  await startSession(user.id);
  return "ok";
}

export async function signOutSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token && isDatabaseConfigured) {
    const db = await sql();
    await db`delete from auth.sessions where token_hash = ${hashToken(token)}`;
  }
  store.delete(SESSION_COOKIE);
}

/** Updates the display name stored on the account. */
export async function updateAccountName(userId: string, fullName: string) {
  const db = await sql();
  await db`update auth.users set raw_user_meta_data = raw_user_meta_data || ${db.json({ full_name: fullName })}, updated_at = now() where id = ${userId}`;
}
