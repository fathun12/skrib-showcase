-- 0060: count of notes with at least one OPEN report, for the admin badges.
-- A separate small function: 0050 stays as it is.
begin;

create or replace function private.admin_open_note_report_count()
 returns integer
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return (
    select count(distinct r.snapshot->>'note_id')::integer
      from public.note_reports r
     where r.status = 'open'
  );
end;
$function$;

create or replace function public.admin_open_note_report_count()
 returns integer
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select private.admin_open_note_report_count();
$function$;

revoke all on function private.admin_open_note_report_count() from public, anon;
revoke all on function public.admin_open_note_report_count() from public, anon;
grant execute on function private.admin_open_note_report_count() to authenticated;
grant execute on function public.admin_open_note_report_count() to authenticated;

commit;