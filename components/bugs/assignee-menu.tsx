"use client";
import { UserX } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useAssignable, useMe } from "@/lib/hooks";
import { assignBug } from "@/lib/store";
import type { Bug } from "@/lib/types";

export function AssigneeMenu({ bug, children, align = "start" }: { bug: Bug; children: ReactNode; align?: "start" | "end" }) {
  const devs = useAssignable();
  const me = useMe();
  const { toast } = useToast();
  const pick = async (id: string | null, name?: string) => {
    if (id === bug.assigneeId) return;
    const res = await assignBug(bug.id, id);
    if (res.ok) toast(id ? `${bug.id} assigned to ${name}` : `${bug.id} is now unassigned`);
  };
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align={align} className="w-[232px]" onClick={(e) => e.stopPropagation()}>
        <MenuLabel>Team</MenuLabel>
        {devs.map((d) => (
          <MenuItem key={d.id} selected={bug.assigneeId === d.id} onSelect={() => void pick(d.id, d.name)}>
            <span className="flex items-center gap-2">
              <Avatar name={d.name} id={d.id} size={20} />
              {d.name}
              {d.id === me?.id ? <span className="text-xs text-muted">(you)</span> : null}
            </span>
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={<UserX className="size-4" />} disabled={!bug.assigneeId} onSelect={() => void pick(null)}>
          Unassign
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
