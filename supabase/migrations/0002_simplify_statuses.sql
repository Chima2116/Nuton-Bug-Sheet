-- Simplifies the workflow: five statuses, no required reasons, no role restrictions on status changes.
-- Run once in the Supabase SQL editor (after 0001). Safe on a database that already has bugs.
--
-- Open -> In Progress -> Ready for Testing -> Resolved, plus Reopened.
-- "Verified" and "Closed" become Resolved. Bugs that were verified keep a small "verified" mark.
-- Nothing is deleted: bugs, comments, history, files and assignments are all kept, and archived bugs are restored to the list.

alter table public.bugs disable trigger bugs_before_update;

alter table public.bugs
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references public.profiles (id) on delete set null;

-- Remember which bugs had been verified before merging the statuses.
update public.bugs b set
  verified_at = coalesce(b.resolved_at, b.updated_at),
  verified_by = (select a.actor_id from public.bug_activity a
                 where a.bug_id = b.id and a.type = 'status' and a.to_value = 'Verified'
                 order by a.created_at desc limit 1)
where b.verified_at is null
  and (b.status = 'Verified' or exists (select 1 from public.bug_activity a where a.bug_id = b.id and a.type = 'status' and a.to_value = 'Verified'));

alter table public.bugs drop constraint if exists bugs_status_check;
update public.bugs set status = 'Resolved' where status in ('Verified', 'Closed');
update public.bugs set resolved_at = coalesce(resolved_at, updated_at) where status = 'Resolved';
update public.bugs set archived = false where archived;
alter table public.bugs add constraint bugs_status_check
  check (status in ('Open', 'In Progress', 'Ready for Testing', 'Resolved', 'Reopened'));

-- Keep the history readable with the new names.
update public.bug_activity set from_value = 'Resolved' where type = 'status' and from_value in ('Verified', 'Closed');
update public.bug_activity set to_value   = 'Resolved' where type = 'status' and to_value   in ('Verified', 'Closed');

alter table public.bug_activity drop constraint if exists bug_activity_type_check;
alter table public.bug_activity add constraint bug_activity_type_check
  check (type in ('reported', 'status', 'assignment', 'comment', 'edit', 'attachment', 'archive', 'verified'));

alter table public.bugs enable trigger bugs_before_update;

-- ---------------------------------------------------------------- triggers
create or replace function public.bugs_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Status only changes through change_bug_status() / verify_bug(), which keep the history in sync.
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
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- status changes: any team member, any status, no reason needed
create or replace function public.change_bug_status(p_bug uuid, p_to text, p_note text default null, p_fix text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.bugs;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  now_ts timestamptz := now();
begin
  if auth.uid() is null or public.app_role() is null then raise exception 'Not signed in.'; end if;
  if p_to not in ('Open', 'In Progress', 'Ready for Testing', 'Resolved', 'Reopened') then raise exception 'Unknown status.'; end if;
  select * into b from public.bugs where id = p_bug for update;
  if not found then raise exception 'Bug not found.'; end if;
  if b.status = p_to then return; end if;

  perform set_config('app.status_rpc', '1', true);

  update public.bugs set
    status      = p_to,
    fixed_at    = case when p_to = 'Ready for Testing' then now_ts else fixed_at end,
    resolved_at = case when p_to = 'Resolved' then coalesce(resolved_at, now_ts) else null end,
    verified_at = case when p_to = 'Resolved' then verified_at else null end,
    verified_by = case when p_to = 'Resolved' then verified_by else null end,
    assignee_id = case when p_to = 'In Progress' and assignee_id is null then auth.uid() else assignee_id end
  where id = p_bug;

  insert into public.bug_activity (bug_id, type, actor_id, from_value, to_value, text)
  values (p_bug, 'status', auth.uid(), b.status, p_to, note);

  perform set_config('app.status_rpc', '', true);
end $$;

-- Marks a fix as verified. Also resolves the bug if it isn't already.
create or replace function public.verify_bug(p_bug uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.bugs;
  note text := nullif(btrim(coalesce(p_note, '')), '');
  now_ts timestamptz := now();
begin
  if auth.uid() is null or public.app_role() is null then raise exception 'Not signed in.'; end if;
  select * into b from public.bugs where id = p_bug for update;
  if not found then raise exception 'Bug not found.'; end if;
  if b.status = 'Resolved' and b.verified_at is not null then return; end if;

  perform set_config('app.status_rpc', '1', true);
  update public.bugs set
    status = 'Resolved', resolved_at = coalesce(resolved_at, now_ts), verified_at = now_ts, verified_by = auth.uid()
  where id = p_bug;

  if b.status <> 'Resolved' then
    insert into public.bug_activity (bug_id, type, actor_id, from_value, to_value) values (p_bug, 'status', auth.uid(), b.status, 'Resolved');
  end if;
  insert into public.bug_activity (bug_id, type, actor_id, text) values (p_bug, 'verified', auth.uid(), note);
  perform set_config('app.status_rpc', '', true);
end $$;

grant execute on function public.change_bug_status(uuid, text, text, text) to authenticated;
grant execute on function public.verify_bug(uuid, text) to authenticated;
revoke execute on function public.verify_bug(uuid, text) from anon;

-- Comments, edits and attachment notes written by the browser (status/assignment/verified entries are written by the database).
-- (Unchanged: the "team can comment" policy already allows only comment, edit and attachment.)
