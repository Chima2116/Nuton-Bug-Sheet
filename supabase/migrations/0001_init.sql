-- Nuton Bug sheet: schema, security rules and workflow enforcement. (Run 0002_simplify_statuses.sql after this one.)
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- STEP 1 - EDIT THE TWO LINES BELOW before running. Only these two emails can ever have an account.
-- Roles: 'designer' reports, tests and verifies bugs. 'developer' fixes bugs. Both can add and edit bugs and assign them.

create table public.team_members (
  email text primary key,
  name  text not null,
  role  text not null check (role in ('designer', 'developer'))
);

insert into public.team_members (email, name, role) values
  ('your-email@example.com',  'Your Name',      'designer'),
  ('david-email@example.com', 'David Akpughe',  'developer');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text not null,
  name                  text not null,
  role                  text not null check (role in ('designer', 'developer')),
  notifications_seen_at timestamptz not null default now(),
  last_active_at        timestamptz not null default now(),
  created_at            timestamptz not null default now()
);

-- Role of the signed-in user (never trust the client for this).
create function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Creates a profile when an account is created, and refuses anyone who isn't on the team list.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.team_members;
begin
  select * into m from public.team_members where lower(email) = lower(new.email);
  if not found then
    raise exception 'This email is not on the team.';
  end if;
  insert into public.profiles (id, email, name, role) values (new.id, new.email, m.name, m.role);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- modules & settings
create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text not null default '',
  keywords    text[] not null default '{}',
  created_at  timestamptz not null default now()
);

insert into public.modules (name, description, keywords) values
  ('AI Tutor',          'Chat panel, streaming responses and tutor context', '{tutor,"chat panel","tutor panel",assistant}'),
  ('Lessons',           'Lesson reader, contents and lesson layout',         '{lesson,reader,"table of contents",reading}'),
  ('Lesson Generation', 'Creating lessons from prompts and sources',         '{generate,generated,generation,generating}'),
  ('Sources',           'Sources modal, uploads and citations',              '{sources,"source modal",upload,citation}'),
  ('Recents',           'Recent lessons and library list',                   '{recents,recent,library}'),
  ('Navigation',        'Sidebar, menus and routing',                        '{sidebar,navigation,menu,nav}'),
  ('Search',            'Global search and results',                         '{search,results}'),
  ('Quizzes & Practice','Quizzes, scoring and progress',                     '{quiz,score,practice,question}'),
  ('Onboarding',        'First-run setup and welcome flow',                  '{onboarding,welcome,"first run","sign up"}'),
  ('Account Settings',  'Profile, email and preferences',                    '{account,profile,"email change",preferences}');

create table public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- bugs
create table public.bugs (
  id               uuid primary key default gen_random_uuid(),
  seq              bigint generated always as identity unique,
  title            text not null,
  description      text not null default '',
  steps            text[] not null default '{}',
  expected         text not null default '',
  actual           text not null default '',
  severity         text not null check (severity in ('Critical', 'High', 'Medium', 'Low')),
  priority         text not null check (priority in ('P0', 'P1', 'P2', 'P3')),
  category         text not null check (category in ('UI/Visual', 'Functional', 'Responsive', 'Performance', 'Data', 'Accessibility')),
  module_id        uuid references public.modules (id) on delete restrict,
  environment      text not null default '',
  status           text not null default 'Open' check (status in ('Open', 'In Progress', 'Ready for Testing', 'Verified', 'Reopened', 'Closed')),
  reporter_id      uuid not null references public.profiles (id),
  assignee_id      uuid references public.profiles (id) on delete set null,
  dev_notes        text not null default '',
  fix_description  text not null default '',
  fixed_at         timestamptz,
  resolved_at      timestamptz,
  archived         boolean not null default false,
  original_report  text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index bugs_status_idx on public.bugs (status);
create index bugs_assignee_idx on public.bugs (assignee_id);

create table public.bug_activity (
  id         uuid primary key default gen_random_uuid(),
  bug_id     uuid not null references public.bugs (id) on delete cascade,
  type       text not null check (type in ('reported', 'status', 'assignment', 'comment', 'edit', 'attachment', 'archive')),
  actor_id   uuid not null references public.profiles (id),
  text       text,
  from_value text,
  to_value   text,
  created_at timestamptz not null default now()
);
create index bug_activity_bug_idx on public.bug_activity (bug_id, created_at);

-- Original uploaded files live in the private "attachments" storage bucket; this table tracks them.
create table public.attachments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('image', 'video', 'file')),
  mime        text not null,
  size        bigint not null default 0,
  path        text not null unique,
  uploaded_by uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.bug_attachments (
  bug_id        uuid not null references public.bugs (id) on delete cascade,
  attachment_id uuid not null references public.attachments (id) on delete cascade,
  primary key (bug_id, attachment_id)
);

create table public.drafts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- triggers on bugs
create function public.bugs_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.bug_activity (bug_id, type, actor_id, text, created_at)
  values (new.id, 'reported', new.reporter_id, 'Reported this bug', new.created_at);
  return new;
end $$;
create trigger bugs_after_insert after insert on public.bugs
  for each row execute function public.bugs_after_insert();

create function public.bugs_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Status can only change through change_bug_status(), which enforces who may do what.
  if new.status is distinct from old.status and coalesce(current_setting('app.status_rpc', true), '') <> '1' then
    raise exception 'Use change_bug_status() to change a bug''s status.';
  end if;
  if new.reporter_id is distinct from old.reporter_id or new.seq is distinct from old.seq or new.created_at is distinct from old.created_at then
    raise exception 'Reporter, ID and creation date cannot be changed.';
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.bug_activity (bug_id, type, actor_id, from_value, to_value)
    values (new.id, 'assignment', auth.uid(), old.assignee_id::text, new.assignee_id::text);
  end if;

  if new.archived is distinct from old.archived then
    if new.archived and new.status not in ('Verified', 'Closed') then
      raise exception 'Only Verified or Closed bugs can be archived.';
    end if;
    insert into public.bug_activity (bug_id, type, actor_id, text)
    values (new.id, 'archive', auth.uid(), case when new.archived then 'Archived this bug' else 'Restored this bug from the archive' end);
  end if;

  new.updated_at := now();
  return new;
end $$;
create trigger bugs_before_update before update on public.bugs
  for each row execute function public.bugs_before_update();

-- New comments, edits and attachments also bump the bug's "last updated".
create function public.activity_touch_bug() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.bugs set updated_at = new.created_at where id = new.bug_id and updated_at < new.created_at;
  return new;
end $$;
-- Status, assignment and archive entries are written while the bug row itself is being updated, so skip those.
create trigger activity_touch_bug after insert on public.bug_activity
  for each row when (new.type in ('comment', 'edit', 'attachment'))
  execute function public.activity_touch_bug();

-- ---------------------------------------------------------------- status workflow
-- Mirrors lib/workflow.ts. 'verify' = designer, 'progress' = developer.
-- needs: fix = fix description required, comment = comment required, note / none = optional.
create function public.change_bug_status(p_bug uuid, p_to text, p_note text default null, p_fix text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.bugs;
  me_role text := public.app_role();
  rule record;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  fix  text := nullif(btrim(coalesce(p_fix, '')), '');
  now_ts timestamptz := now();
  prev_assignee uuid;
begin
  if auth.uid() is null or me_role is null then raise exception 'Not signed in.'; end if;
  select * into b from public.bugs where id = p_bug for update;
  if not found then raise exception 'Bug not found.'; end if;
  if b.archived then raise exception 'Restore this bug from the archive first.'; end if;

  select * into rule from (values
    ('Open',              'In Progress',       'progress', 'none'),
    ('Open',              'Closed',            'verify',   'comment'),
    ('In Progress',       'Ready for Testing', 'progress', 'fix'),
    ('In Progress',       'Open',              'progress', 'note'),
    ('Ready for Testing', 'Verified',          'verify',   'note'),
    ('Ready for Testing', 'Reopened',          'verify',   'comment'),
    ('Ready for Testing', 'In Progress',       'progress', 'note'),
    ('Reopened',          'In Progress',       'progress', 'none'),
    ('Reopened',          'Closed',            'verify',   'comment'),
    ('Verified',          'Closed',            'verify',   'note'),
    ('Verified',          'Reopened',          'verify',   'comment'),
    ('Closed',            'Reopened',          'verify',   'comment')
  ) as t(from_status, to_status, perm, needs)
  where t.from_status = b.status and t.to_status = p_to;

  if not found then raise exception 'A bug that is % cannot move to %.', b.status, p_to; end if;
  if (rule.perm = 'verify' and me_role <> 'designer') or (rule.perm = 'progress' and me_role <> 'developer') then
    raise exception 'Your role cannot move a bug from % to %.', b.status, p_to;
  end if;
  if rule.needs = 'fix' and coalesce(fix, nullif(btrim(b.fix_description), '')) is null then
    raise exception 'Describe the fix before submitting for testing.';
  end if;
  if rule.needs = 'comment' and note is null then
    raise exception 'Add a comment explaining why.';
  end if;

  perform set_config('app.status_rpc', '1', true);
  prev_assignee := b.assignee_id;

  update public.bugs set
    status          = p_to,
    fix_description = case when p_to = 'Ready for Testing' and fix is not null then fix else fix_description end,
    fixed_at        = case when p_to = 'Ready for Testing' then now_ts else fixed_at end,
    resolved_at     = case when p_to in ('Verified', 'Closed') then coalesce(resolved_at, now_ts) when p_to = 'Reopened' then null else resolved_at end,
    assignee_id     = case when p_to = 'In Progress' and assignee_id is null and me_role = 'developer' then auth.uid() else assignee_id end
  where id = p_bug;

  insert into public.bug_activity (bug_id, type, actor_id, from_value, to_value, text)
  values (p_bug, 'status', auth.uid(), b.status, p_to,
          coalesce(note, case when p_to = 'Ready for Testing' then coalesce(fix, b.fix_description) end));

  perform set_config('app.status_rpc', '', true);
end $$;

-- ---------------------------------------------------------------- row level security
alter table public.team_members    enable row level security;   -- no policies: not readable from the browser
alter table public.profiles        enable row level security;
alter table public.modules         enable row level security;
alter table public.settings        enable row level security;
alter table public.bugs            enable row level security;
alter table public.bug_activity    enable row level security;
alter table public.attachments     enable row level security;
alter table public.bug_attachments enable row level security;
alter table public.drafts          enable row level security;

create policy "team can read profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile"     on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (name, notifications_seen_at, last_active_at) on public.profiles to authenticated;

create policy "team can read modules"   on public.modules for select to authenticated using (true);
create policy "team can add modules"    on public.modules for insert to authenticated with check (public.app_role() is not null);
create policy "team can edit modules"   on public.modules for update to authenticated using (public.app_role() is not null) with check (true);
create policy "team can remove modules" on public.modules for delete to authenticated using (public.app_role() is not null);

create policy "team can read settings"  on public.settings for select to authenticated using (true);
create policy "team can add settings"   on public.settings for insert to authenticated with check (public.app_role() is not null);
create policy "team can edit settings"  on public.settings for update to authenticated using (public.app_role() is not null) with check (true);

create policy "team can read bugs"   on public.bugs for select to authenticated using (true);
create policy "team can report bugs" on public.bugs for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'Open' and public.app_role() is not null);
create policy "team can update bugs" on public.bugs for update to authenticated using (public.app_role() is not null) with check (true);

create policy "team can read activity" on public.bug_activity for select to authenticated using (true);
create policy "team can comment"       on public.bug_activity for insert to authenticated
  with check (actor_id = auth.uid() and type in ('comment', 'edit', 'attachment'));

create policy "team can read attachments" on public.attachments for select to authenticated using (true);
create policy "team can upload"           on public.attachments for insert to authenticated with check (uploaded_by = auth.uid());
create policy "remove own unlinked file"  on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() and not exists (select 1 from public.bug_attachments ba where ba.attachment_id = attachments.id));

create policy "team can read bug files" on public.bug_attachments for select to authenticated using (true);
create policy "team can link files"     on public.bug_attachments for insert to authenticated with check (public.app_role() is not null);

create policy "own drafts" on public.drafts for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant execute on function public.change_bug_status(uuid, text, text, text) to authenticated;
revoke execute on function public.change_bug_status(uuid, text, text, text) from anon;

-- ---------------------------------------------------------------- storage (screenshots and recordings)
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)
on conflict (id) do nothing;

create policy "team reads files"   on storage.objects for select to authenticated using (bucket_id = 'attachments');
create policy "team uploads files" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "team removes own files" on storage.objects for delete to authenticated using (bucket_id = 'attachments' and owner = auth.uid());

-- ---------------------------------------------------------------- realtime (so both of you see changes live)
alter publication supabase_realtime add table
  public.bugs, public.bug_activity, public.attachments, public.bug_attachments, public.modules, public.profiles, public.settings;
