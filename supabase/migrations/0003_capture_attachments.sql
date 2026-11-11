-- Capture from Nuton: keep the original screenshot and the annotated version, plus a little page context.
-- Run once in the Supabase SQL editor (after 0001 and 0002). Existing attachments keep working unchanged.

alter table public.attachments
  add column if not exists variant   text  not null default 'upload' check (variant in ('upload', 'capture', 'annotated')),
  add column if not exists source_id uuid  references public.attachments (id) on delete set null,
  add column if not exists meta      jsonb;

-- variant: 'upload'    a file someone chose or pasted
--          'capture'   a screenshot taken from Nuton (original, no annotations)
--          'annotated' the same screenshot with annotations drawn in; source_id points at the original 'capture'
-- meta:    page path, title, capture time, browser, OS, screen and viewport size. Never cookies or storage.

create index if not exists attachments_source_idx on public.attachments (source_id);
