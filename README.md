# Nuton Bug sheet

A private bug tracker for two people: a product designer who reports, tests and verifies, and a developer who fixes. Write a bug in plain text, review it as a structured report, track it on a spreadsheet-style sheet, and move it through fix and verification.

Built with Next.js (App Router), TypeScript, Tailwind CSS and Supabase (Auth, Postgres, Storage, Realtime).

## Set up

1. **Create a Supabase project** at supabase.com.
2. **Run the database setup.** Open `supabase/migrations/0001_init.sql`, edit the two `team_members` lines at the top (your email and David's), then paste the whole file into the Supabase **SQL Editor** and run it.
3. **Create the two accounts.** *Authentication → Users → Add user*: add each of you with the same emails you used above, a password, and *Auto confirm* ticked. Then in *Authentication → Sign In / Providers* turn **off** "Allow new users to sign up". (Even if left on, the database refuses any email that isn't in `team_members`.)
4. **Add your keys.** Copy `.env.local.example` to `.env.local` and fill in the project URL and anon (publishable) key from *Project Settings → API*.
5. **Run it.**
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   ```
6. For "Forgot password" links to work, add your site URL (e.g. `http://localhost:3000`) under *Authentication → URL Configuration → Redirect URLs*.

Until the keys are present the app shows a setup screen instead of the login.

## Who can do what

| | Product Designer | Developer |
| --- | --- | --- |
| Report, edit and assign bugs | ✓ | ✓ |
| Start work, record a fix, submit for testing | | ✓ |
| Verify, reopen, close, archive | ✓ | |
| Comment, attach files | ✓ | ✓ |
| Manage modules and definitions | ✓ | ✓ |

The workflow is enforced **in the database**, not just the UI: `change_bug_status()` in the migration checks the caller's role and the allowed transition, so a developer can't verify their own fix even by calling the API directly. Open → In Progress → Ready for Testing → Verified / Reopened → Closed.

## Security model

- Row Level Security is on for every table. Only signed-in team members can read or write.
- `team_members` is not readable from the browser. A trigger on `auth.users` rejects any email not listed in it.
- Roles live in `profiles.role` and can't be changed by the client. Reporter, bug ID and created date are immutable.
- Screenshots and recordings go to a **private** `attachments` bucket (50 MB per file) and are shown via short-lived signed URLs. Originals are never resized or re-encoded.
- Status, assignment and archive entries in the activity log are written by the database. The browser can only add comments, edits and attachment notes, and only as itself.

## Notes

- **Structuring is not AI.** `lib/extract.ts` is a local, rule-based extractor. It only restructures what you wrote, leaves fields blank or marked *Needs review* when the text doesn't say, and marks severity, priority, category and module as *Suggested*. Replace `structureReport()` with a model call when you're ready; the review screen already handles per-field flags.
- Both of you see changes live (Supabase Realtime). If Realtime isn't enabled, changes still appear after you act or reload.
- Starter modules (AI Tutor, Lessons, Sources …) are inserted by the migration. Edit them in *Settings → Modules*.

## Structure

```
app/                 routes: /login, /reset-password, /, /bugs, /bugs/[id], /report, /my-tasks, /verified, /archived, /settings
components/          ui, layout, bugs, report, settings
lib/store.ts         all reads and writes to Supabase (one place to change)
lib/auth.tsx         session handling
lib/blobs.ts         Storage uploads and signed URLs
lib/workflow.ts      status rules (mirrored in the SQL function)
lib/extract.ts       mock structuring
supabase/migrations  schema, security, workflow function
```
