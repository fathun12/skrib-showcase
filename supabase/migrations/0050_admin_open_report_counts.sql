-- 0050: how many open reports wait for an admin decision, for the badges on
-- the Moderation link and on the tabs. Counts items (a post, a comment, a
-- series), the same grouping the tabs use. Admin only; it reads no report text.

create or replace function private.admin_open_report_counts()
 returns table (posts integer, comments integer, series integer)
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
    (select count(distinct r.post_id)::integer
       from public.reports r
      where r.status = 'open'),
    (select count(distinct r.comment_id)::integer
       from public.comment_reports r
      where r.status = 'open'),
    (select count(distinct r.series_id)::integer
       from public.series_reports r
      where r.status = 'open');
end;
$function$;

create or replace function public.admin_open_report_counts()
 returns table (posts integer, comments integer, series integer)
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_open_report_counts();
$function$;

revoke all on function private.admin_open_report_counts() from public, anon;
revoke all on function public.admin_open_report_counts() from public, anon;
grant execute on function private.admin_open_report_counts() to authenticated;
grant execute on function public.admin_open_report_counts() to authenticated;