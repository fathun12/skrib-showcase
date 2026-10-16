-- Comment moderation shows the quote of a Respond comment.
-- New column in a `returns table` function: drop and create again.
drop function if exists public.admin_list_comment_reports(text, integer, integer);
drop function if exists private.admin_list_comment_reports(text, integer, integer);

create function private.admin_list_comment_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  comment_id uuid,
  comment_snippet text,
  comment_quote text,
  comment_author_id uuid,
  author_username text,
  author_display_name text,
  post_id uuid,
  post_title text,
  post_slug text,
  post_owner_username text,
  report_count integer,
  reasons text[],
  latest_report_at timestamp with time zone,
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
    c.id,
    left(c.body, 200),
    c.quote,
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
$function$;

revoke all on function private.admin_list_comment_reports(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.admin_list_comment_reports(text, integer, integer)
  to authenticated;

create function public.admin_list_comment_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  comment_id uuid,
  comment_snippet text,
  comment_quote text,
  comment_author_id uuid,
  author_username text,
  author_display_name text,
  post_id uuid,
  post_title text,
  post_slug text,
  post_owner_username text,
  report_count integer,
  reasons text[],
  latest_report_at timestamp with time zone,
  reports jsonb
)
language sql
stable
set search_path to ''
as $function$
  select * from private.admin_list_comment_reports(p_status, p_limit, p_offset);
$function$;

revoke all on function public.admin_list_comment_reports(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_list_comment_reports(text, integer, integer)
  to authenticated, service_role;