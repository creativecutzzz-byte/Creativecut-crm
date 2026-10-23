"use client";

import { signUp, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useActionState } from "react";

export function SignUpForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="full_name">Your name</Label>
        <Input id="full_name" name="full_name" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@creativecut.in" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <p className="mt-1 text-[11px] text-subtle">At least 8 characters.</p>
      </div>

      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
      {state.message && <p className="text-xs text-emerald-300">{state.message}</p>}

      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
