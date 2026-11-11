import { Suspense } from "react";
import { ReportFlow } from "@/components/report/report-flow";

export const metadata = { title: "Report as notes" };

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportFlow />
    </Suspense>
  );
}
