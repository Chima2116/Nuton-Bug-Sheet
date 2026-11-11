"use client";
import { Suspense, useMemo } from "react";
import { BugSheet } from "@/components/bugs/bug-sheet";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { useBugs } from "@/lib/hooks";

export default function ArchivedPage() {
  const all = useBugs();
  const bugs = useMemo(() => all.filter((b) => b.archived), [all]);
  return (
    <PageBody wide>
      <PageHeader title="Archived" description="Closed bugs kept for reference. Their full history and attachments are preserved." />
      <div className="mt-6">
        <Suspense fallback={null}>
          <BugSheet bugs={bugs} mode="archived" emptyTitle="The archive is empty" emptyBody="Archive Verified or Closed bugs from the bug sheet or a bug's menu." />
        </Suspense>
      </div>
    </PageBody>
  );
}
