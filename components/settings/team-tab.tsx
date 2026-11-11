"use client";
import { Check, Minus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useMe, useRoles, useUsers } from "@/lib/hooks";
import { PERMISSIONS } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export function TeamTab() {
  const users = useUsers();
  const roles = useRoles();
  const me = useMe();

  return (
    <div className="space-y-12">
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

      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-ink">What each role can do</h2>
          <p className="mt-0.5 text-[13px] text-muted">Verifying a fix always stays with the designer, so a developer can&apos;t sign off their own work.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-wash text-xs font-medium text-muted">
                <th className="h-10 border-b border-line px-4">Permission</th>
                {roles.map((r) => (
                  <th key={r.id} className="h-10 w-40 border-b border-line px-4">{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.id}>
                  <td className="border-b border-line px-4 py-2.5 last-of-type:border-b-0">
                    <p className="text-[13px] text-ink">{p.label}</p>
                    <p className="text-xs text-muted">{p.hint}</p>
                  </td>
                  {roles.map((r) => (
                    <td key={r.id} className="border-b border-line px-4 py-2.5">
                      {r.permissions.includes(p.id) ? <Check className="size-4 text-olive-600" aria-label="Allowed" /> : <Minus className={cn("size-4 text-faint")} aria-label="Not allowed" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
