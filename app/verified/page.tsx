"use client";
import { Suspense, useMemo } from "react";
import { BugSheet } from "@/components/bugs/bug-sheet";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { useActiveBugs } from "@/lib/hooks";

export default function VerifiedPage() {
  const all = useActiveBugs();
  const bugs = useMemo(() => all.filter((b) => b.status === "Verified"), [all]);
  return (
    <PageBody wide>
      <PageHeader title="Verified" description="Fixes the reporter has tested and confirmed. Close them out when they ship." />
      <div className="mt-6">
        <Suspense fallback={null}>
          <BugSheet bugs={bugs} mode="verified" emptyTitle="Nothing verified yet" emptyBody="Bugs appear here after the reporter verifies a fix." />
        </Suspense>
      </div>
    </PageBody>
  );
}
