-- 0063: retention and legal hold for note reports, manual purge,
-- erasure on account deletion, and the disclosure log.
-- admin_list_note_reports is dropped and recreated because it returns two
-- more columns. Retention numbers (90 days dismissed, 12 months decided) are
-- the owner's choice and live in admin_moderate_note.
begin;

alter table private.moderation_log
  drop constraint if exists moderation_log_action_valid;
alter table private.moderation_log
  add constraint moderation_log_action_valid
  check (action in (
    'hide', 'delete', 'restore', 'dismiss', 'suspend', 'unsuspend',
    'comment_delete', 'comment_dismiss', 'series_delete', 'series_dismiss',
    'note_hide', 'note_delete', 'note_dismiss', 'note_restore',
    'note_hold', 'note_hold_release'
  ));

create index if not exists note_reports_retain_idx
  on public.note_reports (retain_until)
  where retain_until is not null;

-- Reports decided before this migration get a retention date from today.
update public.note_reports
   set retain_until = now() + interval '12 months'
 where status = 'resolved' and retain_until is null;
update public.note_reports
   set retain_until = now() + interval '90 days'
 where status = 'dismissed' and retain_until is null;

-- Audit trail of manual purges (no foreign keys, like moderation_log).
create table private.note_report_purge_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  purged_count integer not null check (purged_count > 0),
  created_at timestamptz not null default now()
);
alter table private.note_report_purge_log enable row level security;

-- Requests from the authorities (append only: no edit and no delete function).
create table private.disclosure_log (
  id uuid primary key default gen_random_uuid(),
  received_on date not null,
  requester text not null check (char_length(requester) between 1 and 200),
  reference text check (reference is null or char_length(reference) between 1 and 100),
  kind text not null check (kind in ('subscriber_info', 'traffic_data', 'content', 'other')),
  summary text not null check (char_length(summary) between 1 and 1000),
  note_id uuid,
  user_id uuid,
  handled_by uuid not null,
  created_at timestamptz not null default now()
);
alter table private.disclosure_log enable row level security;

-- Admin list of note reports: now with legal_hold and retain_until.
drop function if exists public.admin_list_note_reports(text, integer, integer);
drop function if exists private.admin_list_note_reports(text, integer, integer);

create or replace function private.admin_list_note_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   note_id uuid,
   note_status text,
   author_id uuid,
   author_username text,
   author_display_name text,
   note_text text,
   written_at timestamptz,
   parent jsonb,
   report_count integer,
   reasons text[],
   latest_report_at timestamptz,
   reports jsonb,
   legal_hold boolean,
   retain_until timestamptz
 )
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  return query
  with grouped as (
    select
      r.snapshot->>'note_id' as nid,
      count(*)::integer as cnt,
      array_agg(distinct r.reason order by r.reason) as rsn,
      max(r.created_at) as latest,
      (array_agg(r.snapshot order by r.created_at desc))[1] as snap,
      jsonb_agg(
        jsonb_build_object(
          'reason', r.reason,
          'details', r.details,
          'created_at', r.created_at
        )
        order by r.created_at desc
      ) as rep,
      bool_or(r.legal_hold) as hold,
      max(r.retain_until) as keep
    from public.note_reports r
    where r.status = p_status
    group by r.snapshot->>'note_id'
  )
  select
    g.nid::uuid,
    coalesce(n.status::text, 'deleted'),
    (g.snap->>'author_id')::uuid,
    g.snap->>'author_username',
    a.display_name,
    g.snap->>'text',
    (g.snap->>'written_at')::timestamptz,
    g.snap->'parent',
    g.cnt,
    g.rsn,
    g.latest,
    g.rep,
    g.hold,
    g.keep
  from grouped g
  left join public.notes n on n.id = g.nid::uuid
  left join public.profiles a on a.id = (g.snap->>'author_id')::uuid
  order by g.latest desc, g.nid
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$function$;

create or replace function public.admin_list_note_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   note_id uuid,
   note_status text,
   author_id uuid,
   author_username text,
   author_display_name text,
   note_text text,
   written_at timestamptz,
   parent jsonb,
   report_count integer,
   reasons text[],
   latest_report_at timestamptz,
   reports jsonb,
   legal_hold boolean,
   retain_until timestamptz
 )
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_list_note_reports(p_status, p_limit, p_offset);
$function$;

-- Decide a note report: same as 0061, plus retain_until on every decision.
create or replace function private.admin_moderate_note(
  p_note_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
 returns table (author_id uuid, snippet text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_status text;
  v_author uuid;
  v_snippet text;
  v_count integer;
  v_reasons text[];
  v_snap jsonb;
  v_reason text := nullif(btrim(p_reason), '');
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'delete', 'dismiss', 'restore') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
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

  -- Restore: only a note hidden by a moderator. It needs no open report.
  if p_action = 'restore' then
    select n.author_id, n.status::text,
           left(regexp_replace(n.body, '\s+', ' ', 'g'), 80)
      into v_author, v_status, v_snippet
    from public.notes n
    where n.id = p_note_id
    for update;

    if not found then
      raise exception 'note_not_found';
    end if;
    if v_status <> 'hidden' then
      raise exception 'note_not_hidden';
    end if;

    select count(*)::integer,
           coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[])
      into v_count, v_reasons
    from public.note_reports r
    where r.snapshot->>'note_id' = p_note_id::text;

    insert into private.moderation_log
      (post_id, post_title, post_author_id, admin_id, action,
       report_count, reasons, reason, note, note_id)
    values
      (null, v_snippet, v_author, v_admin, 'note_restore',
       v_count, v_reasons, null, v_note, p_note_id);

    update public.notes set status = 'published' where id = p_note_id;

    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'note_restored', v_snippet, null, null);

    return query select v_author, v_snippet;
    return;
  end if;

  select count(*)::integer,
         coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[]),
         (array_agg(r.snapshot order by r.created_at desc))[1]
    into v_count, v_reasons, v_snap
  from public.note_reports r
  where r.snapshot->>'note_id' = p_note_id::text
    and r.status = 'open';

  if v_count = 0 then
    raise exception 'no_open_reports';
  end if;

  v_author := (v_snap->>'author_id')::uuid;
  v_snippet := left(regexp_replace(coalesce(v_snap->>'text', ''), '\s+', ' ', 'g'), 80);

  select n.status::text
    into v_status
  from public.notes n
  where n.id = p_note_id
  for update;

  if not found and p_action <> 'dismiss' then
    raise exception 'note_not_found';
  end if;
  if p_action = 'hide' and v_status = 'hidden' then
    raise exception 'note_already_hidden';
  end if;

  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action,
     report_count, reasons, reason, note, note_id)
  values
    (null, v_snippet, v_author, v_admin,
     case p_action
       when 'hide' then 'note_hide'
       when 'delete' then 'note_delete'
       else 'note_dismiss'
     end,
     v_count, v_reasons, v_reason, v_note, p_note_id);

  -- Every reporter (whose account still exists) is told that the report was
  -- reviewed, whatever the decision. No outcome, no mail.
  insert into public.moderation_notices (recipient_id, action)
  select distinct r.reporter_id, 'report_reviewed'
  from public.note_reports r
  where r.snapshot->>'note_id' = p_note_id::text
    and r.status = 'open'
    and r.reporter_id is not null;

  if p_action = 'hide' then
    update public.notes set status = 'hidden' where id = p_note_id;
    update public.note_reports
       set status = 'resolved', retain_until = now() + interval '12 months'
     where snapshot->>'note_id' = p_note_id::text and status = 'open';
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'note_hidden', v_snippet, v_reason, v_note);
  elsif p_action = 'delete' then
    update public.note_reports
       set status = 'resolved', retain_until = now() + interval '12 months'
     where snapshot->>'note_id' = p_note_id::text and status = 'open';
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'note_deleted', v_snippet, v_reason, v_note);
    delete from public.notes where id = p_note_id;
  else
    update public.note_reports
       set status = 'dismissed', retain_until = now() + interval '90 days'
     where snapshot->>'note_id' = p_note_id::text and status = 'open';
  end if;

  return query select v_author, v_snippet;
end;
$function$;

-- Legal hold on every report of one note (a note is required). Releasing a
-- hold on a report whose date has passed makes it purgeable at the next purge.
create or replace function private.admin_set_note_legal_hold(
  p_note_id uuid,
  p_hold boolean,
  p_note text
)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_admin uuid := auth.uid();
  v_note text := nullif(btrim(p_note), '');
  v_count integer;
  v_reasons text[];
  v_snap jsonb;
  v_snippet text;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_hold is null then
    raise exception 'invalid_hold' using errcode = '22023';
  end if;
  if v_note is null then
    raise exception 'note_required' using errcode = '22023';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  select count(*)::integer,
         coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[]),
         (array_agg(r.snapshot order by r.created_at desc))[1]
    into v_count, v_reasons, v_snap
  from public.note_reports r
  where r.snapshot->>'note_id' = p_note_id::text;

  if v_count = 0 then
    raise exception 'no_reports';
  end if;

  v_snippet := left(regexp_replace(coalesce(v_snap->>'text', ''), '\s+', ' ', 'g'), 80);

  update public.note_reports
     set legal_hold = p_hold
   where snapshot->>'note_id' = p_note_id::text;

  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action,
     report_count, reasons, reason, note, note_id)
  values
    (null, v_snippet, (v_snap->>'author_id')::uuid, v_admin,
     case when p_hold then 'note_hold' else 'note_hold_release' end,
     v_count, v_reasons, null, v_note, p_note_id);
end;
$function$;

create or replace function public.admin_set_note_legal_hold(
  p_note_id uuid,
  p_hold boolean,
  p_note text
)
 returns void
 language sql
 security invoker
 set search_path to ''
as $function$
  select private.admin_set_note_legal_hold(p_note_id, p_hold, p_note);
$function$;

-- Purge preview: what the next purge would delete.
create or replace function private.admin_preview_note_report_purge()
 returns table (purgeable integer, on_hold integer, waiting integer)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
  select
    (select count(*)::integer from public.note_reports r
      where r.status <> 'open' and not r.legal_hold
        and r.retain_until is not null and r.retain_until <= now()),
    (select count(*)::integer from public.note_reports r
      where r.legal_hold),
    (select count(*)::integer from public.note_reports r
      where r.status <> 'open' and not r.legal_hold
        and r.retain_until > now());
end;
$function$;

create or replace function public.admin_preview_note_report_purge()
 returns table (purgeable integer, on_hold integer, waiting integer)
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_preview_note_report_purge();
$function$;

-- Purge: deletes decided reports whose date has passed and that are not on hold.
create or replace function private.admin_purge_note_reports()
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_deleted integer;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  with gone as (
    delete from public.note_reports r
     where r.status <> 'open'
       and not r.legal_hold
       and r.retain_until is not null
       and r.retain_until <= now()
    returning 1
  )
  select count(*)::integer into v_deleted from gone;

  if v_deleted > 0 then
    insert into private.note_report_purge_log (admin_id, purged_count)
    values (auth.uid(), v_deleted);
  end if;

  return v_deleted;
end;
$function$;

create or replace function public.admin_purge_note_reports()
 returns integer
 language sql
 security invoker
 set search_path to ''
as $function$
  select private.admin_purge_note_reports();
$function$;

-- Disclosure log: add and list.
create or replace function private.admin_add_disclosure(
  p_received_on date,
  p_requester text,
  p_kind text,
  p_summary text,
  p_reference text default null,
  p_note_id uuid default null,
  p_user_id uuid default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_requester text := nullif(btrim(p_requester), '');
  v_summary text := nullif(btrim(p_summary), '');
  v_reference text := nullif(btrim(p_reference), '');
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_received_on is null or p_received_on > current_date + 1 then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if v_requester is null or char_length(v_requester) > 200 then
    raise exception 'invalid_requester' using errcode = '22023';
  end if;
  if p_kind is null
     or p_kind not in ('subscriber_info', 'traffic_data', 'content', 'other') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if v_summary is null or char_length(v_summary) > 1000 then
    raise exception 'invalid_summary' using errcode = '22023';
  end if;
  if v_reference is not null and char_length(v_reference) > 100 then
    raise exception 'invalid_reference' using errcode = '22023';
  end if;

  insert into private.disclosure_log
    (received_on, requester, reference, kind, summary, note_id, user_id, handled_by)
  values
    (p_received_on, v_requester, v_reference, p_kind, v_summary,
     p_note_id, p_user_id, auth.uid())
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.admin_add_disclosure(
  p_received_on date,
  p_requester text,
  p_kind text,
  p_summary text,
  p_reference text default null,
  p_note_id uuid default null,
  p_user_id uuid default null
)
 returns uuid
 language sql
 security invoker
 set search_path to ''
as $function$
  select private.admin_add_disclosure(
    p_received_on, p_requester, p_kind, p_summary,
    p_reference, p_note_id, p_user_id
  );
$function$;

create or replace function private.admin_list_disclosures(
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   id uuid,
   received_on date,
   requester text,
   reference text,
   kind text,
   summary text,
   note_id uuid,
   user_id uuid,
   created_at timestamptz
 )
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
  select d.id, d.received_on, d.requester, d.reference, d.kind, d.summary,
         d.note_id, d.user_id, d.created_at
  from private.disclosure_log d
  order by d.received_on desc, d.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$function$;

create or replace function public.admin_list_disclosures(
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   id uuid,
   received_on date,
   requester text,
   reference text,
   kind text,
   summary text,
   note_id uuid,
   user_id uuid,
   created_at timestamptz
 )
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_list_disclosures(p_limit, p_offset);
$function$;

-- Account deletion: same as 0045, plus the erasure of report copies about this
-- user that were not acted on (open or dismissed) and are not on legal hold.
-- A refused deletion (admin, co-authors) deletes nothing.
create or replace function private.delete_my_account()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  -- The last admin must not disappear: remove the admin row by hand first.
  if private.is_admin() then
    raise exception 'account_is_admin';
  end if;
  -- A post with accepted co-authors is shared work: the owner removes the
  -- co-authors first.
  if exists (
    select 1
      from public.post_collaborators c
      join public.posts p on p.id = c.post_id
     where p.author_id = v_user
       and c.status = 'accepted'
  ) then
    raise exception 'account_has_coauthors';
  end if;

  delete from public.note_reports r
   where r.snapshot->>'author_id' = v_user::text
     and not r.legal_hold
     and r.status <> 'resolved';

  delete from auth.users where id = v_user;
end;
$function$;

revoke all on function private.admin_list_note_reports(text, integer, integer) from public, anon;
revoke all on function public.admin_list_note_reports(text, integer, integer) from public, anon;
revoke all on function private.admin_set_note_legal_hold(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_note_legal_hold(uuid, boolean, text) from public, anon;
revoke all on function private.admin_preview_note_report_purge() from public, anon;
revoke all on function public.admin_preview_note_report_purge() from public, anon;
revoke all on function private.admin_purge_note_reports() from public, anon;
revoke all on function public.admin_purge_note_reports() from public, anon;
revoke all on function private.admin_add_disclosure(date, text, text, text, text, uuid, uuid) from public, anon;
revoke all on function public.admin_add_disclosure(date, text, text, text, text, uuid, uuid) from public, anon;
revoke all on function private.admin_list_disclosures(integer, integer) from public, anon;
revoke all on function public.admin_list_disclosures(integer, integer) from public, anon;

grant execute on function private.admin_list_note_reports(text, integer, integer) to authenticated;
grant execute on function public.admin_list_note_reports(text, integer, integer) to authenticated;
grant execute on function private.admin_set_note_legal_hold(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_note_legal_hold(uuid, boolean, text) to authenticated;
grant execute on function private.admin_preview_note_report_purge() to authenticated;
grant execute on function public.admin_preview_note_report_purge() to authenticated;
grant execute on function private.admin_purge_note_reports() to authenticated;
grant execute on function public.admin_purge_note_reports() to authenticated;
grant execute on function private.admin_add_disclosure(date, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.admin_add_disclosure(date, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function private.admin_list_disclosures(integer, integer) to authenticated;
grant execute on function public.admin_list_disclosures(integer, integer) to authenticated;

commit;