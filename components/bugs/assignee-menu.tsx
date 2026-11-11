"use client";
import { UserX } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useAssignable, useMe } from "@/lib/hooks";
import type { Bug } from "@/lib/types";
import { useBugActions } from "./use-bug-actions";

export function AssigneeMenu({ bug, children, align = "start" }: { bug: Bug; children: ReactNode; align?: "start" | "end" }) {
  const devs = useAssignable();
  const me = useMe();
  const { assign } = useBugActions();
  const pick = (id: string | null, name?: string) => assign(bug, id, name);
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
