import type { ActivityItem, Bug, User } from "./types";

export function activityVerb(a: ActivityItem, users: Map<string, User>): string {
  switch (a.type) {
    case "reported":
      return "reported this bug";
    case "status":
      return `moved this from ${a.from} to ${a.to}`;
    case "assignment": {
      const to = a.to ? users.get(a.to)?.name : null;
      if (!a.to) return "removed the assignee";
      return a.from ? `reassigned this to ${to}` : `assigned this to ${to}`;
    }
    case "comment":
      return "commented";
    case "edit":
      return a.text ? `edited ${a.text.toLowerCase().startsWith("edited") ? a.text.slice(7) : a.text}` : "edited this bug";
    case "attachment":
      return a.text?.toLowerCase().startsWith("added") ? a.text.toLowerCase() : "attached files";
    case "archive":
      return a.text?.toLowerCase().includes("restored") ? "restored this from the archive" : "archived this bug";
    case "verified":
      return "verified the fix";
  }
}

/** Short, bug-prefixed sentence for feeds: "moved NUT-0101 to In Progress". */
export function feedVerb(a: ActivityItem, bug: Bug, users: Map<string, User>): string {
  switch (a.type) {
    case "reported":
      return `reported ${bug.id}`;
    case "status":
      return `moved ${bug.id} to ${a.to}`;
    case "assignment":
      return a.to ? `assigned ${bug.id} to ${users.get(a.to)?.name.split(" ")[0]}` : `unassigned ${bug.id}`;
    case "comment":
      return `commented on ${bug.id}`;
    case "edit":
      return `edited ${bug.id}`;
    case "attachment":
      return `attached files to ${bug.id}`;
    case "archive":
      return a.text?.toLowerCase().includes("restored") ? `restored ${bug.id}` : `archived ${bug.id}`;
    case "verified":
      return `verified ${bug.id}`;
  }
}
