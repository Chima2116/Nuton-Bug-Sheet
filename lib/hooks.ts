"use client";
import { useCallback, useMemo } from "react";
import { useStore } from "./store";
import type { AppModule, Bug, Permission, Role, User } from "./types";

export const useReady = () => useStore((s) => s.status === "ready");
export const useSyncStatus = () => useStore((s) => s.status);
export const useSyncError = () => useStore((s) => s.error);
export const useBugs = () => useStore((s) => s.bugs);
export const useUsers = () => useStore((s) => s.users);
export const useModules = () => useStore((s) => s.modules);
export const useRoles = () => useStore((s) => s.roles);
export const useDrafts = () => useStore((s) => s.drafts);
export const useDefinitions = () => useStore((s) => s.definitions);

export function useMe(): User | undefined {
  const users = useUsers();
  const id = useStore((s) => s.currentUserId);
  return useMemo(() => users.find((u) => u.id === id), [users, id]);
}

export function usePerms() {
  const me = useMe();
  const roles = useRoles();
  const role: Role | undefined = useMemo(() => roles.find((r) => r.id === me?.roleId), [roles, me]);
  const can = useCallback((p: Permission) => !!role?.permissions.includes(p), [role]);
  return { can, role, permissions: role?.permissions ?? [] };
}

export function useUserMap() {
  const users = useUsers();
  return useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
}
export function useModuleMap() {
  const modules = useModules();
  return useMemo(() => new Map<string, AppModule>(modules.map((m) => [m.id, m])), [modules]);
}

export function useBug(id: string): Bug | undefined {
  const bugs = useBugs();
  return useMemo(() => bugs.find((b) => b.id.toLowerCase() === id.toLowerCase()), [bugs, id]);
}

/** Active (non-archived) bugs. */
export function useActiveBugs() {
  const bugs = useBugs();
  return useMemo(() => bugs.filter((b) => !b.archived), [bugs]);
}

/** Anyone on the team can be assigned a bug (the developer fixes, the designer follows up or tests). */
export function useAssignable() {
  return useUsers();
}
