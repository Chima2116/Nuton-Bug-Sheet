"use client";
import { useEffect, type ReactNode } from "react";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth";
import { setErrorHandler } from "@/lib/store";

function ErrorBridge() {
  const { toast } = useToast();
  useEffect(() => {
    setErrorHandler((m) => toast(m, { tone: "error" }));
  }, [toast]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ErrorBridge />
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
