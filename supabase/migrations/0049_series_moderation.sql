-- 0049: reports and moderation of series.
-- Same pattern as comments (0021, 0043): a report table, admin functions that
-- write the log, the notice and the report status in ONE transaction, and a
-- log and notice action for the delete.

-- 1. The log and the notices learn the new actions.
alter table private.moderation_log
  add column series_id uuid;

do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'private.moderation_log'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%comment_dismiss%';
  if v_name is not null then
    execute format('alter table private.moderation_log drop constraint %I', v_name);
  end if;

  select conname into v_name
    from pg_constraint
   where conrelid = 'public.moderation_notices'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%comment_deleted%';
  if v_name is not null then
    execute format('alter table public.moderation_notices drop constraint %I', v_name);
  end if;
end $$;

alter table private.moderation_log
  add constraint moderation_log_action_valid
  check (action in (
    'hide', 'delete', 'restore', 'dismiss', 'suspend', 'unsuspend',
    'comment_delete', 'comment_dismiss', 'series_delete', 'series_dismiss'
  ));

alter table public.moderation_notices
  add constraint moderation_notices_action_valid
  check (action in (
    'hidden', 'deleted', 'restored', 'suspended', 'unsuspended',
    'comment_deleted', 'series_deleted'
  ));

-- 2. The report table.
create table public.series_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  series_id uuid not null
    references public.series (id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint series_reports_reason_valid
    check (reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  constraint series_reports_details_length
    check (details is null or (char_length(details) >= 1 and char_length(details) <= 500)),
  constraint series_reports_status_valid
    check (status in ('open', 'resolved', 'dismissed')),
  constraint series_reports_one_per_user unique (reporter_id, series_id)
);

create index series_reports_series_idx on public.series_reports (series_id);

alter table public.series_reports enable row level security;

revoke all on table public.series_reports from anon, authenticated;
grant insert (series_id, reason, details) on public.series_reports to authenticated;

-- Insert only: nobody reads reports through the API. A report needs a series
-- of someone else that has at least one published story.
create policy series_reports_insert_own on public.series_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1
        from public.series s
       where s.id = series_reports.series_id
         and s.author_id <> (select auth.uid())
         and exists (
           select 1
             from public.series_posts sp
             join public.posts p on p.id = sp.post_id
            where sp.series_id = s.id
              and p.status = 'published'
         )
    )
  );

create policy suspended_no_insert_series_reports on public.series_reports
  as restrictive
  for insert
  with check (not (select private.is_suspended()));

-- 3. Admin: list the reports, grouped by series.
create or replace function private.admin_list_series_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   series_id uuid,
   series_title text,
   series_description text,
   series_slug text,
   author_id uuid,
   author_username text,
   author_display_name text,
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
  select
    s.id,
    s.title,
    s.description,
    s.slug,
    a.id,
    a.username,
    a.display_name,
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
  from public.series_reports r
  join public.series s on s.id = r.series_id
  join public.profiles a on a.id = s.author_id
  where r.status = p_status
  group by s.id, a.id
  order by max(r.created_at) desc, s.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$function$;

create or replace function public.admin_list_series_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   series_id uuid,
   series_title text,
   series_description text,
   series_slug text,
   author_id uuid,
   author_username text,
   author_display_name text,
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
  select * from private.admin_list_series_reports(p_status, p_limit, p_offset);
$function$;

-- 4. Admin: delete a series (reason required) or dismiss its reports.
-- Stories are never touched: only the grouping and its cover go.
create or replace function private.admin_moderate_series(
  p_series_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
 returns table (author_id uuid, title text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_author uuid;
  v_title text;
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

  -- Lock the series so two decisions cannot cross each other.
  select s.author_id, s.title
    into v_author, v_title
  from public.series s
  where s.id = p_series_id
  for update;

  if not found then
    raise exception 'series_not_found';
  end if;

  select count(*)::integer,
         coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[])
    into v_count, v_reasons
  from public.series_reports r
  where r.series_id = p_series_id and r.status = 'open';

  -- post_author_id holds the author of the moderated item (here: the series
  -- owner); post_title holds the series title. No foreign key on purpose, so
  -- the row survives the delete.
  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action,
     report_count, reasons, reason, note, series_id)
  values
    (null, v_title, v_author, v_admin,
     case when p_action = 'delete' then 'series_delete' else 'series_dismiss' end,
     v_count, v_reasons, v_reason, v_note, p_series_id);

  if p_action = 'delete' then
    update public.series_reports set status = 'resolved'
     where series_id = p_series_id and status = 'open';
    insert into public.moderation_notices
      (recipient_id, action, subject, reason, note)
    values
      (v_author, 'series_deleted', left(v_title, 200), v_reason, v_note);
    -- The membership rows and the reports go with it (cascade).
    delete from public.series where id = p_series_id;
  else
    update public.series_reports set status = 'dismissed'
     where series_id = p_series_id and status = 'open';
  end if;

  return query select v_author, v_title;
end;
$function$;

create or replace function public.admin_moderate_series(
  p_series_id uuid,
  p_action text,
  p_reason text default null,
  p_note text default null
)
 returns table (author_id uuid, title text)
 language sql
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_moderate_series(p_series_id, p_action, p_reason, p_note);
$function$;

revoke all on function private.admin_list_series_reports(text, integer, integer) from public, anon;
revoke all on function public.admin_list_series_reports(text, integer, integer) from public, anon;
revoke all on function private.admin_moderate_series(uuid, text, text, text) from public, anon;
revoke all on function public.admin_moderate_series(uuid, text, text, text) from public, anon;
grant execute on function private.admin_list_series_reports(text, integer, integer) to authenticated;
grant execute on function public.admin_list_series_reports(text, integer, integer) to authenticated;
grant execute on function private.admin_moderate_series(uuid, text, text, text) to authenticated;
grant execute on function public.admin_moderate_series(uuid, text, text, text) to authenticated;