-- Public byline data: accepted co-authors of PUBLISHED posts only.
-- Pending invitees and drafts never appear.
create function private.post_authors(p_post_ids uuid[])
returns table (
  post_id uuid,
  username text,
  display_name text,
  avatar_url text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select pc.post_id, pr.username, pr.display_name, pr.avatar_url, pc.accepted_at
  from public.post_collaborators pc
  join public.posts p on p.id = pc.post_id and p.status = 'published'
  join public.profiles pr on pr.id = pc.user_id
  where pc.status = 'accepted'
    and pr.username is not null
    and cardinality(p_post_ids) <= 100
    and pc.post_id = any (p_post_ids)
  order by pc.post_id, pc.accepted_at;
$$;

create function public.get_post_coauthors(p_post_ids uuid[])
returns table (
  post_id uuid,
  username text,
  display_name text,
  avatar_url text,
  accepted_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.post_authors(p_post_ids);
$$;

revoke all on function private.post_authors(uuid[]) from public;
revoke all on function public.get_post_coauthors(uuid[]) from public;
grant usage on schema private to anon;
grant execute on function private.post_authors(uuid[]) to anon, authenticated;
grant execute on function public.get_post_coauthors(uuid[]) to anon, authenticated;