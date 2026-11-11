# Capture from Nuton (on hold)

Parked on purpose; nothing here is deleted. To bring it back:

1. Move `capture.ts` to `lib/capture.ts` and `quick-report.tsx` back into `components/report/`, and adapt the report composer to call `useNutonCapture` (see `quick-report.tsx` for the working wiring).
2. Merge the Nuton pull request (`Akpughe/nuton-web` #64) and set `VITE_BUG_CAPTURE_ORIGINS` / `VITE_BUG_CAPTURE_EMAILS` on Nuton.
3. The database side stays in place: `supabase/migrations/0003_capture_attachments.sql` and the `variant` / `meta` handling in `lib/blobs.ts`.

Protocol and security notes: `nuton-capture-protocol.md`.
