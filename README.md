# Nuton Bug sheet

A private bug tracker for two people: a product designer who reports, tests and verifies, and a developer who fixes. Write a bug in plain text, review it as a structured report, track it on a spreadsheet-style sheet, and move it through fix and verification.

Built with Next.js (App Router), TypeScript, Tailwind CSS and Supabase (Auth, Postgres, Storage, Realtime).

## Set up

1. **Create a Supabase project** at supabase.com.
2. **Run the database setup.** Open `supabase/migrations/0001_init.sql`, edit the two `team_members` lines at the top (your email and David's), then paste the whole file into the Supabase **SQL Editor** and run it. Then run `supabase/migrations/0002_simplify_statuses.sql` and `supabase/migrations/0003_capture_attachments.sql` the same way, in that order. Both are safe on a database that already has bugs.
3. **Create the two accounts.** *Authentication → Users → Add user*: add each of you with the same emails you used above, a password, and *Auto confirm* ticked. Then in *Authentication → Sign In / Providers* turn **off** "Allow new users to sign up". (Even if left on, the database refuses any email that isn't in `team_members`.)
4. **Add your keys.** Copy `.env.local.example` to `.env.local` and fill in the project URL and anon (publishable) key from *Project Settings → API*.
5. **Run it.**
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   ```
6. For "Forgot password" links to work, add your site URL (e.g. `http://localhost:3000`) under *Authentication → URL Configuration → Redirect URLs*.

Until the keys are present the app shows a setup screen instead of the login.

## How it works

- **Statuses:** Open, In Progress, Ready for Testing, Resolved, Reopened. Everything lives in **All Bugs**, so resolved bugs stay as a full history. Use the tabs and filters to narrow the list.
- **No friction:** Starting work, resolving, reopening, verifying, changing status and assigning all happen immediately, with no confirmation and no required reason. A toast confirms each change and offers **Undo**. You can leave a comment on a bug any time, but nothing asks for one.
- **Verified** is a small optional mark (a check next to *Resolved*), not a status or a separate page.
- Both of you can report, edit, assign and change the status of any bug. The two accounts are listed in `team_members`.

## Security model

- Row Level Security is on for every table. Only signed-in team members can read or write.
- `team_members` is not readable from the browser. A trigger on `auth.users` rejects any email not listed in it.
- Roles live in `profiles.role` and can't be changed by the client. Reporter, bug ID and created date are immutable.
- Status changes go through `change_bug_status()` / `verify_bug()` so the history is always written by the database.
- Screenshots and recordings go to a **private** `attachments` bucket (50 MB per file) and are shown via short-lived signed URLs. Originals are never resized or re-encoded.
- Status, assignment and archive entries in the activity log are written by the database. The browser can only add comments, edits and attachment notes, and only as itself.

## Capture from Nuton

On **Report a Bug**, *Capture from Nuton* opens nuton.app in its own window. You draw on the problem, press **Add to bug**, and the screenshot (the untouched original plus the annotated version, with page, browser and screen details) lands on your draft in the Bug Sheet. The Bug Sheet side is built. The capture module that runs inside Nuton is a separate piece of work in the Nuton codebase.

- Protocol and security rules: `docs/nuton-capture-protocol.md`.
- The address Nuton is opened at is `NEXT_PUBLIC_NUTON_ORIGIN` (default `https://nuton.app`).
- Nuton must trust the Bug Sheet's own address. Until the Bug Sheet is deployed that is `http://localhost:3000`.
- The old text-first form is still available at `/report/notes` for reporting several issues at once.

## Notes

- **Structuring is not AI.** `lib/extract.ts` is a local, rule-based extractor. It only restructures what you wrote, leaves fields blank or marked *Needs review* when the text doesn't say, and marks severity, priority, category and module as *Suggested*. Replace `structureReport()` with a model call when you're ready; the review screen already handles per-field flags.
- Both of you see changes live (Supabase Realtime). If Realtime isn't enabled, changes still appear after you act or reload.
- Starter modules (AI Tutor, Lessons, Sources …) are inserted by the migration. Edit them in *Settings → Modules*.

## Structure

```
app/                 routes: /login, /reset-password, /, /bugs, /bugs/[id], /report, /report/notes, /my-tasks, /settings
components/          ui, layout, bugs, report, settings
lib/store.ts         all reads and writes to Supabase (one place to change)
lib/auth.tsx         session handling
lib/blobs.ts         Storage uploads and signed URLs
lib/workflow.ts      quick actions and toast copy
lib/extract.ts       mock structuring
lib/capture.ts       handoff with the capture window in Nuton
supabase/migrations  schema, security, workflow function
```
