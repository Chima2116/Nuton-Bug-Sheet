"use client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlay";
import { feedVerb } from "@/lib/activity";
import { useBugs, useMe, useUserMap } from "@/lib/hooks";
import { markNotificationsSeen, useStore } from "@/lib/store";
import { cn, timeAgo } from "@/lib/utils";

export function Notifications() {
  const me = useMe();
  const bugs = useBugs();
  const users = useUserMap();
  const seenAt = useStore((s) => s.notificationsSeenAt);
  const [open, setOpen] = useState(false);

  const items = useMemo(() => {
    if (!me) return [];
    return bugs
      .filter((b) => b.reporterId === me.id || b.assigneeId === me.id)
      .flatMap((b) => b.activity.filter((a) => a.actorId !== me.id && a.type !== "attachment").map((a) => ({ a, b })))
      .sort((x, y) => +new Date(y.a.at) - +new Date(x.a.at))
      .slice(0, 10);
  }, [bugs, me]);

  const unread = items.filter((i) => +new Date(i.a.at) > +new Date(seenAt)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className="relative">
          <Bell className="size-[17px]" strokeWidth={1.75} />
          {unread ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-olive-600 ring-2 ring-white" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-24px))]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">Notifications</p>
          <button disabled={!unread} onClick={markNotificationsSeen} className="text-xs text-olive-700 hover:underline disabled:text-faint disabled:no-underline">
            Mark all as read
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {items.length === 0 ? <p className="px-3 py-8 text-center text-[13px] text-muted">Nothing new. Updates on your bugs will show up here.</p> : null}
          {items.map(({ a, b }) => {
            const actor = users.get(a.actorId);
            const isNew = +new Date(a.at) > +new Date(seenAt);
            return (
              <Link key={a.id} href={`/bugs/${b.id}`} onClick={() => setOpen(false)} className="flex gap-3 rounded-md px-2.5 py-2.5 hover:bg-wash">
                <Avatar name={actor?.name ?? "?"} id={actor?.id} size={28} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-ink-2">
                    <span className="font-medium text-ink">{actor?.name}</span> {feedVerb(a, b, users)}
                  </p>
                  {a.text && (a.type === "comment" || a.type === "status") ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{a.text}</p> : null}
                  <p className="mt-0.5 text-xs text-faint">{timeAgo(a.at)}</p>
                </div>
                <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", isNew ? "bg-olive-600" : "bg-transparent")} />
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
