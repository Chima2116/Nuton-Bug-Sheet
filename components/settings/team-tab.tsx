"use client";
import { Avatar } from "@/components/ui/avatar";
import { useMe, useRoles, useUsers } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";

export function TeamTab() {
  const users = useUsers();
  const roles = useRoles();
  const me = useMe();

  return (
    <div>
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">Team</h2>
          <p className="mt-0.5 text-[13px] text-muted">The two people in this workspace. Accounts are managed in Supabase, so there is no public sign-up.</p>
        </div>
        <ul className="divide-y divide-line rounded-lg border border-line">
          {users.map((u) => {
            const role = roles.find((r) => r.id === u.roleId);
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
                <div className="flex min-w-0 flex-1 basis-[240px] items-center gap-3">
                  <Avatar name={u.name} id={u.id} size={36} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                      {u.name}
                      {u.id === me?.id ? <span className="rounded bg-wash-2 px-1.5 py-px text-[11px] font-normal text-muted">You</span> : null}
                    </p>
                    <p className="truncate text-[13px] text-muted">{u.email}</p>
                  </div>
                </div>
                <div className="min-w-0 flex-1 basis-[200px]">
                  <p className="text-[13px] text-ink">{role?.name}</p>
                  <p className="text-xs text-muted">Active {timeAgo(u.lastActiveAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
