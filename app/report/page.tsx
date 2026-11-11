import { Suspense } from "react";
import { QuickReport } from "@/components/report/quick-report";

export const metadata = { title: "Report a Bug" };

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <QuickReport />
    </Suspense>
  );
}
