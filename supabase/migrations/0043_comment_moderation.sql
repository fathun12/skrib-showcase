-- 0043_comment_moderation.sql
-- Run after 0042.
-- Moderation round M3a: comment moderation (MODERATION_SPEC 3.3).
-- Preflight answer (0021): replies and reports of a deleted comment go with
-- it (on delete cascade). The log row and the notice are the record.

begin;

-- 1. moderation_log: comment_id and the two new actions.
alter table private.moderation_log add column comment_id uuid;

alter table private.moderation_log drop constraint moderation_log_action_valid;
alter table private.moderation_log
  add constraint moderation_log_action_valid
    check (action in ('hide', 'delete', 'restore', 'dismiss', 'suspend',
                      'unsuspend', 'comment_delete', 'comment_dismiss'));

-- 2. Reported comments, grouped by comment.
create function private.admin_list_comment_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  comment_id uuid,
  comment_snippet text,
  comment_author_id uuid,
  author_username text,
  author_display_name text,
  post_id uuid,
  post_title text,
  post_slug text,
  post_owner_username text,
  report_count integer,
  reasons text[],
  latest_report_at timestamptz,
  reports jsonb
)
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
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  return query
  select
    c.id,
    left(c.body, 200),
    c.author_id,
    ca.username,
    ca.display_name,
    p.id,
    p.title,
    p.slug,
    po.username,
    count(*)::integer,
    array_agg(distinct r.reason order by r.reason),
    max(r.created_at),
    jsonb_agg(
      jsonb_build_object(
        'reason', r.reason,
        'details', r.details,
        'created_at', r.created_at
      )
      order by r.created_at desc
    )
  from public.comment_reports r
  join public.comments c on c.id = r.comment_id
  join public.posts p on p.id = c.post_id
  join public.profiles ca on ca.id = c.author_id
  join public.profiles po on po.id = p.author_id
  where r.status = p_status
  group by c.id, p.id, ca.id, po.id
  order by max(r.created_at) desc, c.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

-- 3. The decision: delete (reason required) or dismiss.
create function private.admin_moderate_comment(
  p_comment_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
returns table (author_id uuid, snippet text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_author uuid;
  v_post uuid;
  v_body text;
  v_post_title text;
  v_count integer;
  v_reasons text[];
  v_reason text := nullif(btrim(p_reason), '');
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_action not in ('delete', 'dismiss') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  if p_action = 'delete' and v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if v_reason is not null
     and v_reason not in ('spam', 'harassment', 'inappropriate', 'illegal', 'other') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  -- Lock the comment so two decisions cannot cross each other.
  select c.author_id, c.post_id, c.body
    into v_author, v_post, v_body
  from public.comments c
  where c.id = p_comment_id
  for update;

  if not found then
    raise exception 'comment_not_found';
  end if;

  select p.title into v_post_title
  from public.posts p where p.id = v_post;

  select count(*)::integer,
         coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[])
    into v_count, v_reasons
  from public.comment_reports r
  where r.comment_id = p_comment_id and r.status = 'open';

  -- post_author_id holds the author of the moderated item (here: the comment
  -- writer), so the author history line counts it.
  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action,
     report_count, reasons, reason, note, comment_id)
  values
    (v_post, v_post_title, v_author, v_admin,
     case when p_action = 'delete' then 'comment_delete' else 'comment_dismiss' end,
     v_count, v_reasons, v_reason, v_note, p_comment_id);

  if p_action = 'delete' then
    update public.comment_reports set status = 'resolved'
     where comment_id = p_comment_id and status = 'open';
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'comment_deleted', left(v_body, 200), v_reason, v_note);
    -- Replies and the reports go with it (cascade).
    delete from public.comments where id = p_comment_id;
  else
    update public.comment_reports set status = 'dismissed'
     where comment_id = p_comment_id and status = 'open';
  end if;

  return query select v_author, left(v_body, 200);
end;
$$;

-- 4. Public wrappers and grants.
create function public.admin_list_comment_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  comment_id uuid,
  comment_snippet text,
  comment_author_id uuid,
  author_username text,
  author_display_name text,
  post_id uuid,
  post_title text,
  post_slug text,
  post_owner_username text,
  report_count integer,
  reasons text[],
  latest_report_at timestamptz,
  reports jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_comment_reports(p_status, p_limit, p_offset);
$$;

create function public.admin_moderate_comment(
  p_comment_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
returns table (author_id uuid, snippet text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.admin_moderate_comment(p_comment_id, p_action, p_reason, p_note);
$$;

revoke all on function private.admin_list_comment_reports(text, integer, integer) from public, anon;
grant execute on function private.admin_list_comment_reports(text, integer, integer) to authenticated;
revoke all on function private.admin_moderate_comment(uuid, text, text, text) from public, anon;
grant execute on function private.admin_moderate_comment(uuid, text, text, text) to authenticated;

revoke all on function public.admin_list_comment_reports(text, integer, integer) from public, anon;
grant execute on function public.admin_list_comment_reports(text, integer, integer) to authenticated;
revoke all on function public.admin_moderate_comment(uuid, text, text, text) from public, anon;
grant execute on function public.admin_moderate_comment(uuid, text, text, text) to authenticated;

commit;