-- 0059: moderation of notes (admin list, hide, delete, dismiss).
-- Same pattern as series (0049). The evidence stays in note_reports.snapshot;
-- the log keeps only a short snippet and has no foreign key on note_id.
begin;

alter table private.moderation_log
  add column note_id uuid;

alter table private.moderation_log
  drop constraint if exists moderation_log_action_valid;
alter table private.moderation_log
  add constraint moderation_log_action_valid
  check (action in (
    'hide', 'delete', 'restore', 'dismiss', 'suspend', 'unsuspend',
    'comment_delete', 'comment_dismiss', 'series_delete', 'series_dismiss',
    'note_hide', 'note_delete', 'note_dismiss'
  ));

alter table public.moderation_notices
  drop constraint if exists moderation_notices_action_valid;
alter table public.moderation_notices
  add constraint moderation_notices_action_valid
  check (action in (
    'hidden', 'deleted', 'restored', 'suspended', 'unsuspended',
    'comment_deleted', 'series_deleted', 'note_hidden', 'note_deleted'
  ));

-- Admin: list the reports, grouped by the note id kept in the snapshot, so a
-- report still shows after the writer deleted the note.
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
   reports jsonb
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
      ) as rep
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
    g.rep
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
   reports jsonb
 )
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_list_note_reports(p_status, p_limit, p_offset);
$function$;

-- Admin: hide or delete a note (reason required) or dismiss its reports.
-- Hide and delete resolve the reports and tell the writer (notice). Dismiss
-- tells nobody. A note the writer already deleted can only be dismissed.
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
  if p_action not in ('hide', 'delete', 'dismiss') then
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

  select count(*)::integer,
         coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[]),
         (array_agg(r.snapshot order by r.created_at desc))[1]
    into v_count, v_reasons, v_snap
  from public.note_reports r
  where r.snapshot->>'note_id' = p_note_id::text
    and r.status = 'open';

  -- Another admin already decided, or the id is wrong.
  if v_count = 0 then
    raise exception 'no_open_reports';
  end if;

  v_author := (v_snap->>'author_id')::uuid;
  v_snippet := left(regexp_replace(coalesce(v_snap->>'text', ''), '\s+', ' ', 'g'), 80);

  -- Lock the note (if it still exists) so two decisions cannot cross.
  select n.status
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

  -- post_author_id holds the writer of the note; post_title holds a short
  -- snippet (80 characters), never the whole text: the full evidence stays in
  -- note_reports.snapshot. No foreign key on purpose.
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

  if p_action = 'hide' then
    update public.notes set status = 'hidden' where id = p_note_id;
    update public.note_reports set status = 'resolved'
     where snapshot->>'note_id' = p_note_id::text and status = 'open';
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'note_hidden', v_snippet, v_reason, v_note);
  elsif p_action = 'delete' then
    update public.note_reports set status = 'resolved'
     where snapshot->>'note_id' = p_note_id::text and status = 'open';
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'note_deleted', v_snippet, v_reason, v_note);
    -- Replies and likes go with it (cascade). The reports stay, with note_id
    -- set to null, and keep their snapshot.
    delete from public.notes where id = p_note_id;
  else
    update public.note_reports set status = 'dismissed'
     where snapshot->>'note_id' = p_note_id::text and status = 'open';
  end if;

  return query select v_author, v_snippet;
end;
$function$;

create or replace function public.admin_moderate_note(
  p_note_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
 returns table (author_id uuid, snippet text)
 language sql
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_moderate_note(p_note_id, p_action, p_reason, p_note);
$function$;

revoke all on function private.admin_list_note_reports(text, integer, integer) from public, anon;
revoke all on function public.admin_list_note_reports(text, integer, integer) from public, anon;
revoke all on function private.admin_moderate_note(uuid, text, text, text) from public, anon;
revoke all on function public.admin_moderate_note(uuid, text, text, text) from public, anon;
grant execute on function private.admin_list_note_reports(text, integer, integer) to authenticated;
grant execute on function public.admin_list_note_reports(text, integer, integer) to authenticated;
grant execute on function private.admin_moderate_note(uuid, text, text, text) to authenticated;
grant execute on function public.admin_moderate_note(uuid, text, text, text) to authenticated;

commit;