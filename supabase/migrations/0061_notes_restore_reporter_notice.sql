-- 0061: restore a hidden note, and tell each reporter that the report was reviewed.
-- Function signatures are unchanged (create or replace), no type regeneration.
begin;

alter table private.moderation_log
  drop constraint if exists moderation_log_action_valid;
alter table private.moderation_log
  add constraint moderation_log_action_valid
  check (action in (
    'hide', 'delete', 'restore', 'dismiss', 'suspend', 'unsuspend',
    'comment_delete', 'comment_dismiss', 'series_delete', 'series_dismiss',
    'note_hide', 'note_delete', 'note_dismiss', 'note_restore'
  ));

alter table public.moderation_notices
  drop constraint if exists moderation_notices_action_valid;
alter table public.moderation_notices
  add constraint moderation_notices_action_valid
  check (action in (
    'hidden', 'deleted', 'restored', 'suspended', 'unsuspended',
    'comment_deleted', 'series_deleted', 'note_hidden', 'note_deleted',
    'note_restored', 'report_reviewed'
  ));

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
    delete from public.notes where id = p_note_id;
  else
    update public.note_reports set status = 'dismissed'
     where snapshot->>'note_id' = p_note_id::text and status = 'open';
  end if;

  return query select v_author, v_snippet;
end;
$function$;

commit;