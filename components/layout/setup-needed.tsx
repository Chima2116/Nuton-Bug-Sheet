"use client";
import { AuthShell } from "./auth-shell";

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <li className="flex gap-4">
    <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-wash-2 text-xs font-medium text-ink-2">{n}</span>
    <div className="min-w-0 text-[13.5px] leading-relaxed text-ink-2">
      <p className="font-medium text-ink">{title}</p>
      {children}
    </div>
  </li>
);

const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-wash-2 px-1.5 py-0.5 font-mono text-[12.5px] text-ink">{children}</code>;

export function SetupNeeded() {
  return (
    <AuthShell wide title="Connect Supabase" subtitle="The app stores bugs, files and accounts in your Supabase project. It isn't connected yet.">
      <ol className="space-y-6">
        <Step n={1} title="Create a project">
          <p>Go to supabase.com, create a project, then open <b>Project Settings → API</b>.</p>
        </Step>
        <Step n={2} title="Set up the database">
          <p>Open <b>SQL Editor</b>, paste <Code>supabase/migrations/0001_init.sql</Code>, and edit the two <Code>team_members</Code> lines at the top to your email and David&apos;s. Then run it.</p>
        </Step>
        <Step n={3} title="Create your two accounts">
          <p>In <b>Authentication → Users → Add user</b>, add each of you with the same emails and a password (tick <i>Auto confirm</i>). Under <b>Authentication → Sign In / Providers</b>, turn off <i>Allow new users to sign up</i>.</p>
        </Step>
        <Step n={4} title="Add your keys">
          <p>Copy <Code>.env.local.example</Code> to <Code>.env.local</Code> and fill in the project URL and anon key, then restart <Code>npm run dev</Code>.</p>
        </Step>
      </ol>
    </AuthShell>
  );
}
