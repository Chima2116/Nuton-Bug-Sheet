"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageBody } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/controls";
import { useBug } from "@/lib/hooks";
import { BugPanel } from "./bug-panel";

/** The full-page view of a bug (/bugs/NUT-0001). The same panel opens in a side drawer from the list. */
export function BugDetail({ id }: { id: string }) {
  const bug = useBug(id);
  if (!bug)
    return (
      <PageBody>
        <EmptyState title="Bug not found" body={`There's no bug with the ID ${id.toUpperCase()}. The link may be wrong.`} action={<ButtonLink href="/bugs" className="rounded-full">Back to All Bugs</ButtonLink>} />
      </PageBody>
    );
  return (
    <div className="mx-auto w-full max-w-[860px] pb-10 pt-5">
      <Link href="/bugs" className="mb-1 ml-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink sm:ml-8">
        <ArrowRight className="size-3.5 rotate-180" /> All Bugs
      </Link>
      <BugPanel bug={bug} />
    </div>
  );
}
