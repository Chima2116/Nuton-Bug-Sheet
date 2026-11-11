"use client";
import { BookOpenText, Layers, UserRound, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { UnderlineTabs } from "@/components/ui/controls";
import { DefinitionsTab } from "@/components/settings/definitions-tab";
import { ModulesTab } from "@/components/settings/modules-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { TeamTab } from "@/components/settings/team-tab";

const TABS = ["team", "modules", "definitions", "profile"] as const;
type Tab = (typeof TABS)[number];

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : "team";
  return (
    <PageBody>
      <PageHeader title="Settings" description="Team, product modules, definitions and your profile." />
      <div className="mt-6">
        <UnderlineTabs
          value={tab}
          onChange={(t) => router.replace(`/settings?tab=${t}`, { scroll: false })}
          options={[
            { id: "team", label: "Team", icon: <Users className="size-4" /> },
            { id: "modules", label: "Modules", icon: <Layers className="size-4" /> },
            { id: "definitions", label: "Definitions", icon: <BookOpenText className="size-4" /> },
            { id: "profile", label: "Profile", icon: <UserRound className="size-4" /> },
          ]}
        />
        <div className="pt-8">
          {tab === "team" ? <TeamTab /> : tab === "modules" ? <ModulesTab /> : tab === "definitions" ? <DefinitionsTab /> : <ProfileTab />}
        </div>
      </div>
    </PageBody>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  );
}
