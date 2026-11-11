"use client";
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { startSync, stopSync } from "./store";
import { supabase } from "./supabase";

interface AuthValue {
  session: Session | null;
  /** True until the first session check has finished. */
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue>({ session: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (userId) void startSync(userId);
    else stopSync();
  }, [userId]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      signOut: async () => {
        await supabase?.auth.signOut();
      },
    }),
    [session, loading],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
