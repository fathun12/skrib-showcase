-- 0075_note_reports_quote.sql
-- The admin list of note reports also returns the quoted note (text and
-- author) saved in the report copy by 0074. A returns table change needs
-- drop function plus create function, for the public wrapper and the private
-- function, with the grants set again (same pattern as 0070).

begin;

drop function public.admin_list_note_reports(text, integer, integer);
drop function private.admin_list_note_reports(text, integer, integer);

create function private.admin_list_note_reports(
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
  retain_until timestamptz,
  note_quote jsonb
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
    g.keep,
    g.snap->'quote'
  from grouped g
  left join public.notes n on n.id = g.nid::uuid
  left join public.profiles a on a.id = (g.snap->>'author_id')::uuid
  order by g.latest desc, g.nid
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

create function public.admin_list_note_reports(
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
  retain_until timestamptz,
  note_quote jsonb
)
language sql
stable
set search_path = ''
as $$
  select * from private.admin_list_note_reports(p_status, p_limit, p_offset);
$$;

revoke all on function private.admin_list_note_reports(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_note_reports(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.admin_list_note_reports(text, integer, integer)
  to authenticated;
grant execute on function public.admin_list_note_reports(text, integer, integer)
  to authenticated;

commit;