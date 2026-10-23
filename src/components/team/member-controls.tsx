"use client";

import { removeMember, updateMemberRole, type InviteState } from "@/app/actions/team";
import { Select } from "@/components/ui/input";
import type { MemberRole } from "@/lib/types";
import { UserMinus } from "lucide-react";
import { useActionState } from "react";

/** Role picker and remove button for one teammate (owners/admins only). */
export function MemberControls({ id, role, name, invited }: { id: string; role: MemberRole; name: string; invited: boolean }) {
  const [roleState, roleAction, rolePending] = useActionState<InviteState, FormData>(updateMemberRole, {});
  const [removeState, removeAction, removePending] = useActionState<InviteState, FormData>(removeMember, {});
  const error = roleState.error ?? removeState.error;

  return (
    <div className="flex items-center gap-2">
      <form action={roleAction}>
        <input type="hidden" name="id" value={id} />
        <Select
          name="role"
          defaultValue={role}
          disabled={rolePending}
          aria-label={`Role for ${name}`}
          className="h-8 w-28 text-xs"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="member">Member</option>
        </Select>
      </form>
      <form
        action={removeAction}
        onSubmit={(e) => {
          if (!window.confirm(invited ? `Cancel the invitation for ${name}?` : `Remove ${name} from the workspace?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          disabled={removePending}
          aria-label={invited ? `Cancel invitation for ${name}` : `Remove ${name}`}
          title={invited ? "Cancel invitation" : "Remove from workspace"}
          className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-white/5 hover:text-rose-300"
        >
          <UserMinus className="size-4" />
        </button>
      </form>
      {error && <span className="max-w-40 text-[11px] leading-tight text-amber-300">{error}</span>}
    </div>
  );
}
