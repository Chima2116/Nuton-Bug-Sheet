"use client";
import { LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useAuth } from "@/lib/auth";
import { useMe, usePerms } from "@/lib/hooks";

export function UserMenu({ children, side = "bottom", align = "end" }: { children: ReactNode; side?: "top" | "bottom"; align?: "start" | "end" }) {
  const me = useMe();
  const { role } = usePerms();
  const { signOut } = useAuth();
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent side={side} align={align} className="w-[248px]">
        {me ? (
          <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-2">
            <Avatar name={me.name} id={me.id} size={32} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">{me.name}</p>
              <p className="truncate text-xs text-muted">{role?.name}</p>
            </div>
          </div>
        ) : null}
        <MenuSeparator />
        <MenuItem asChild>
          <Link href="/settings?tab=profile"><UserRound className="size-4 text-muted" /> Profile</Link>
        </MenuItem>
        <MenuItem asChild>
          <Link href="/settings"><SettingsIcon className="size-4 text-muted" /> Settings</Link>
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<LogOut className="size-4" />} onSelect={() => void signOut()}>
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
