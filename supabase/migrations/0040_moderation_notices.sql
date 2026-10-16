-- 0040_moderation_notices.sql
-- Run after 0039.
-- Moderation, round M1a (MODERATION_SPEC.md sections 2 and 3.1):
--   1. private.moderation_log gets reason + note; post_id and post_title may
--      be NULL (account and comment actions in M2 and M3 have no post).
--   2. public.moderation_notices: what the author sees in the bell. A
--      SNAPSHOT (subject), no foreign key to the post, NO admin column.
--   3. admin_moderate_post is REPLACED (the old two-argument pair is dropped
--      first, otherwise PostgREST answers PGRST203). hide and delete need a
--      reason (raises reason_required); the notice is written in the same
--      transaction; the function returns (author_id, post_title) because
--      after a delete the post is gone.
--   4. admin_author_history: counts of earlier hide and delete actions.
--   5. Email cap tables (private.email_rules, private.email_log) and
--      admin_prepare_email: reserves a slot and returns the author's
--      address (auth.users is not readable by the app).

begin;

-- ---------------------------------------------------------------------------
-- 1. moderation_log: reason, note, nullable post columns.
-- ---------------------------------------------------------------------------
alter table private.moderation_log
  add column reason text,
  add column note text;

alter table private.moderation_log
  alter column post_id drop not null,
  alter column post_title drop not null;

alter table private.moderation_log
  add constraint moderation_log_reason_valid
    check (reason is null
           or reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  add constraint moderation_log_note_valid
    check (note is null or char_length(note) between 1 and 500);

-- ---------------------------------------------------------------------------
-- 2. moderation_notices.
-- No foreign key on post_id (there is no such column): a "your post was
-- deleted" notice must outlive the post. No admin column: the author never
-- learns who decided.
-- ---------------------------------------------------------------------------
create table public.moderation_notices (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- The whole vocabulary now, so M2 and M3 need no change.
  action text not null,
  -- Post title or comment snippet, a snapshot.
  subject text,
  reason text,
  note text,
  created_at timestamptz not null default now(),
  constraint moderation_notices_action_valid
    check (action in ('hidden', 'deleted', 'restored', 'suspended',
                      'unsuspended', 'comment_deleted')),
  constraint moderation_notices_subject_valid
    check (subject is null or char_length(subject) <= 200),
  constraint moderation_notices_reason_valid
    check (reason is null
           or reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  constraint moderation_notices_note_valid
    check (note is null or char_length(note) between 1 and 500)
);

create index moderation_notices_recipient_idx
  on public.moderation_notices (recipient_id, created_at desc);

alter table public.moderation_notices enable row level security;

revoke all on public.moderation_notices from public, anon, authenticated;
grant select on public.moderation_notices to authenticated;

-- Select own only. NO insert, update or delete policy: only the security
-- definer functions below write.
create policy moderation_notices_select_own
  on public.moderation_notices
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Replace admin_moderate_post.
-- ---------------------------------------------------------------------------
drop function public.admin_moderate_post(uuid, text);
drop function private.admin_moderate_post(uuid, text);

create function private.admin_moderate_post(
  p_post_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
returns table (author_id uuid, post_title text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_title text;
  v_status text;
  v_author uuid;
  v_count integer;
  v_reasons text[];
  v_reason text := nullif(btrim(p_reason), '');
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'delete', 'restore', 'dismiss') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  -- The database, not only the app, requires the reason (decision D3).
  if p_action in ('hide', 'delete') and v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if v_reason is not null
     and v_reason not in ('spam', 'harassment', 'inappropriate', 'illegal', 'other') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  -- Lock the post so two decisions cannot cross each other.
  select p.title, p.status, p.author_id
    into v_title, v_status, v_author
  from public.posts p
  where p.id = p_post_id
  for update;

  if not found then
    raise exception 'post_not_found';
  end if;

  if p_action = 'hide' and v_status <> 'published' then
    raise exception 'moderation_not_published';
  end if;
  if p_action = 'restore' and v_status <> 'hidden' then
    raise exception 'moderation_not_hidden';
  end if;

  select count(*)::integer,
         coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[])
    into v_count, v_reasons
  from public.reports r
  where r.post_id = p_post_id and r.status = 'open';

  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action,
     report_count, reasons, reason, note)
  values
    (p_post_id, v_title, v_author, v_admin, p_action,
     v_count, v_reasons, v_reason, v_note);

  if p_action = 'hide' then
    update public.posts set status = 'hidden' where id = p_post_id;
    update public.reports set status = 'resolved'
     where post_id = p_post_id and status = 'open';
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'hidden', left(v_title, 200), v_reason, v_note);

  elsif p_action = 'restore' then
    update public.posts set status = 'published' where id = p_post_id;
    insert into public.moderation_notices
      (recipient_id, action, subject)
    values
      (v_author, 'restored', left(v_title, 200));

  elsif p_action = 'dismiss' then
    update public.reports set status = 'dismissed'
     where post_id = p_post_id and status = 'open';

  else
    delete from public.posts where id = p_post_id;
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'deleted', left(v_title, 200), v_reason, v_note);
  end if;

  -- The post may be gone now, so the app gets both values from here.
  return query select v_author, v_title;
end;
$$;

create function public.admin_moderate_post(
  p_post_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
returns table (author_id uuid, post_title text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.admin_moderate_post(p_post_id, p_action, p_reason, p_note);
$$;

revoke all on function private.admin_moderate_post(uuid, text, text, text) from public, anon;
grant execute on function private.admin_moderate_post(uuid, text, text, text) to authenticated;
revoke all on function public.admin_moderate_post(uuid, text, text, text) from public, anon;
grant execute on function public.admin_moderate_post(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Author history ("This author: 2 earlier actions (1 hide, 1 delete)").
-- ---------------------------------------------------------------------------
create function private.admin_author_history(p_author_id uuid)
returns table (hide_count integer, delete_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
  select
    (count(*) filter (where l.action = 'hide'))::integer,
    (count(*) filter (where l.action = 'delete'))::integer
  from private.moderation_log l
  where l.post_author_id = p_author_id;
end;
$$;

create function public.admin_author_history(p_author_id uuid)
returns table (hide_count integer, delete_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_author_history(p_author_id);
$$;

revoke all on function private.admin_author_history(uuid) from public, anon;
grant execute on function private.admin_author_history(uuid) to authenticated;
revoke all on function public.admin_author_history(uuid) from public, anon;
grant execute on function public.admin_author_history(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Email cap (decision D10). No address is ever stored here.
-- ---------------------------------------------------------------------------
create table private.email_rules (
  kind text primary key,
  daily_cap integer not null check (daily_cap >= 0)
);

create table private.email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  created_at timestamptz not null default now()
);

create index email_log_kind_created_idx
  on private.email_log (kind, created_at desc);

alter table private.email_rules enable row level security;
alter table private.email_log enable row level security;
revoke all on private.email_rules from public, anon, authenticated;
revoke all on private.email_log from public, anon, authenticated;

insert into private.email_rules (kind, daily_cap) values ('moderation', 20);

-- Returns the author's address when a mail may be sent now, otherwise NULL
-- (unknown kind, unconfirmed address, or the rolling 24 hour cap is reached).
-- A slot is reserved BEFORE the mail is sent, so a failed send still counts.
create function private.admin_prepare_email(p_user_id uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cap integer;
  v_used integer;
  v_email text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select r.daily_cap into v_cap
  from private.email_rules r
  where r.kind = p_kind;

  if not found then
    return null;
  end if;

  -- Only a confirmed address gets mail; an unconfirmed one uses no slot.
  select u.email into v_email
  from auth.users u
  where u.id = p_user_id
    and u.email_confirmed_at is not null;

  if v_email is null then
    return null;
  end if;

  -- Two admins at the same moment must not both take the last slot.
  perform pg_advisory_xact_lock(hashtext('email_log:' || p_kind));

  -- Old rows are not needed (the cap looks back 24 hours only).
  delete from private.email_log
  where created_at < now() - interval '2 days';

  select count(*)::integer into v_used
  from private.email_log l
  where l.kind = p_kind
    and l.created_at > now() - interval '24 hours';

  if v_used >= v_cap then
    return null;
  end if;

  insert into private.email_log (kind) values (p_kind);

  return v_email;
end;
$$;

create function public.admin_prepare_email(p_user_id uuid, p_kind text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.admin_prepare_email(p_user_id, p_kind);
$$;

revoke all on function private.admin_prepare_email(uuid, text) from public, anon;
grant execute on function private.admin_prepare_email(uuid, text) to authenticated;
revoke all on function public.admin_prepare_email(uuid, text) from public, anon;
grant execute on function public.admin_prepare_email(uuid, text) to authenticated;

commit;