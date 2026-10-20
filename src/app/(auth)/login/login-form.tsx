"use client";

import { sendMagicLink, signIn, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useActionState, useState } from "react";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [passwordState, passwordAction, passwordPending] = useActionState<AuthState, FormData>(signIn, { error: initialError });
  const [magicState, magicAction, magicPending] = useActionState<AuthState, FormData>(sendMagicLink, {});
  const state = mode === "password" ? passwordState : magicState;

  return (
    <form action={mode === "password" ? passwordAction : magicAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@creativecut.studio" />
      </div>
      {mode === "password" && (
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
        </div>
      )}

      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
      {state.message && <p className="text-xs text-emerald-300">{state.message}</p>}

      <Button type="submit" variant="primary" className="w-full" disabled={passwordPending || magicPending}>
        {mode === "password" ? (passwordPending ? "Signing in…" : "Sign in") : magicPending ? "Sending…" : "Email me a link"}
      </Button>
      <button type="button" onClick={() => setMode(mode === "password" ? "magic" : "password")} className="w-full text-center text-xs text-muted hover:text-fg">
        {mode === "password" ? "Use a magic link instead" : "Use a password instead"}
      </button>
    </form>
  );
}
