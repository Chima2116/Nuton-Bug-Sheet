"use client";
import { FileText } from "lucide-react";
import { Suspense } from "react";
import { useReport } from "@/components/report/report-host";
import { BugSheet } from "@/components/bugs/bug-sheet";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useActiveBugs, useDrafts } from "@/lib/hooks";

export default function AllBugsPage() {
  const bugs = useActiveBugs();
  const drafts = useDrafts();
  const { open } = useReport();
  return (
    <PageBody wide>
      <PageHeader
        title="All Bugs"
        description="Every confirmed bug in one sheet. Filter, sort and open a row to review the full report."
        actions={
          <>
            {drafts.length ? (
              <Button variant="secondary" className="rounded-full" onClick={() => open()}>
                <FileText className="size-4" /> Drafts <span className="tnum text-muted">{drafts.length}</span>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mt-6">
        <Suspense fallback={null}>
          <BugSheet bugs={bugs} emptyTitle="No bugs have been reported" emptyBody="Reported bugs appear here once they're confirmed." />
        </Suspense>
      </div>
    </PageBody>
  );
}
