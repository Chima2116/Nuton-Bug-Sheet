"use client";
import { useParams } from "next/navigation";
import { BugDetail } from "@/components/bugs/bug-detail";

export default function BugPage() {
  const params = useParams<{ id: string }>();
  return <BugDetail id={decodeURIComponent(params.id)} />;
}
