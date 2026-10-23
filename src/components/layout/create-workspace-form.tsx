"use client";

import { createWorkspace, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useActionState } from "react";

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(createWorkspace, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input id="workspace-name" name="name" required defaultValue="Creative Cut" />
      </div>
      {state.error && <p className="text-xs text-rose-300">{state.error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}
