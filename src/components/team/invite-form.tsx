"use client";

import { inviteMember, type InviteState } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { UserPlus } from "lucide-react";
import { useActionState } from "react";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteMember, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" required placeholder="name@creativecut.studio" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" name="role" defaultValue="member">
            <option value="member">Member</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="invite-title">Title</Label>
          <Input id="invite-title" name="title" placeholder="Designer" />
        </div>
      </div>
      {state.error && <p className="text-xs text-amber-300">{state.error}</p>}
      {state.message && <p className="text-xs text-emerald-300">{state.message}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        <UserPlus className="size-4" /> {pending ? "Inviting…" : "Invite teammate"}
      </Button>
    </form>
  );
}
