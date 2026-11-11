"use client";
import { Archive, ArrowRightLeft, BadgeCheck, FilePlus2, MessageSquare, Pencil, UserRound, Flag } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badges";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { activityVerb } from "@/lib/activity";
import { useMe, useRoles, useUserMap } from "@/lib/hooks";
import { addComment } from "@/lib/store";
import type { ActivityItem, Bug, Status } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

const ICON: Record<ActivityItem["type"], typeof Flag> = {
  reported: Flag,
  status: ArrowRightLeft,
  assignment: UserRound,
  comment: MessageSquare,
  edit: Pencil,
  attachment: FilePlus2,
  archive: Archive,
  verified: BadgeCheck,
};

export function ActivityLog({ bug, composerRef }: { bug: Bug; composerRef?: React.RefObject<HTMLTextAreaElement | null> }) {
  const users = useUserMap();
  const roles = useRoles();
  const me = useMe();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const local = useRef<HTMLTextAreaElement>(null);
  const ref = composerRef ?? local;
  const roleName = (id: string) => {
    const r = roles.find((x) => x.id === users.get(id)?.roleId)?.name ?? "";
    return r.includes("Designer") ? "Designer" : r;
  };

  const submit = async () => {
    if (!text.trim()) return;
    const body = text;
    setText("");
    const res = await addComment(bug.id, body);
    if (res.ok) toast("Comment added");
    else setText(body);
  };

  return (
    <div>
      <ol className="relative">
        {bug.activity.map((a, i) => {
          const actor = users.get(a.actorId);
          const Icon = ICON[a.type];
          const last = i === bug.activity.length - 1;
          if (a.type === "comment") {
            return (
              <li key={a.id} className="relative flex gap-3 pb-6">
                {!last ? <span className="absolute left-[13px] top-8 bottom-0 w-px bg-line" /> : null}
                <Avatar name={actor?.name ?? "?"} id={actor?.id} size={28} className="relative z-10 mt-0.5 ring-4 ring-white" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-medium text-ink">{actor?.name}</span>
                    <span className="rounded bg-wash px-1.5 py-px text-[11px] text-muted">{roleName(a.actorId)}</span>
                    <span className="text-xs text-faint" title={formatDateTime(a.at)}>{timeAgo(a.at)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap rounded-lg rounded-tl-sm bg-wash px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink">{a.text}</p>
                </div>
              </li>
            );
          }
          return (
            <li key={a.id} className="relative flex gap-3 pb-6">
              {!last ? <span className="absolute left-[13px] top-8 bottom-0 w-px bg-line" /> : null}
              <span className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-muted ring-4 ring-white">
                <span className="flex size-7 items-center justify-center rounded-full border border-line bg-white"><Icon className="size-3.5" strokeWidth={1.75} /></span>
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-[13px] text-ink-2">
                  <span className="font-medium text-ink">{actor?.name}</span> {activityVerb(a, users)}
                  <span className="ml-2 text-xs text-faint" title={formatDateTime(a.at)}>{timeAgo(a.at)}</span>
                </p>
                {a.type === "status" ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusBadge status={a.from as Status} className="text-xs" />
                    <span className="text-faint">→</span>
                    <StatusBadge status={a.to as Status} className="text-xs" />
                  </div>
                ) : null}
                {(a.type === "status" || a.type === "verified") && a.text ? <p className="mt-2 whitespace-pre-wrap border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-ink-2">{a.text}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex gap-3">
        <Avatar name={me?.name ?? "?"} id={me?.id} size={28} className="mt-1" />
        <div className="min-w-0 flex-1">
          <Textarea
            ref={ref}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
            }}
            placeholder="Add a comment or implementation note…"
            aria-label="Add a comment"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-faint">⌘ Enter to send</span>
            <Button variant="primary" size="sm" onClick={() => void submit()} disabled={!text.trim()} className={cn(!text.trim() && "opacity-45")}>
              Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
