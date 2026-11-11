import { Suspense } from "react";
import { ReportFlow } from "@/components/report/report-flow";

export const metadata = { title: "Report a Bug" };

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportFlow />
    </Suspense>
  );
}
