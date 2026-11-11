"use client";
import { FileText } from "lucide-react";
import { Suspense } from "react";
import { BugSheet } from "@/components/bugs/bug-sheet";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { useActiveBugs, useDrafts } from "@/lib/hooks";

export default function AllBugsPage() {
  const bugs = useActiveBugs();
  const drafts = useDrafts();
  return (
    <PageBody wide>
      <PageHeader
        title="All Bugs"
        description="Every confirmed bug in one sheet. Filter, sort and open a row to review the full report."
        actions={
          <>
            {drafts.length ? (
              <ButtonLink href="/report#drafts" variant="secondary">
                <FileText className="size-4" /> Drafts <span className="tnum text-muted">{drafts.length}</span>
              </ButtonLink>
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
