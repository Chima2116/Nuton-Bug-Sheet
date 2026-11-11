import { redirect } from "next/navigation";

// Reporting is a modal that opens from anywhere. This keeps old /report links working.
export default function ReportPage() {
  redirect("/bugs?report=1");
}
