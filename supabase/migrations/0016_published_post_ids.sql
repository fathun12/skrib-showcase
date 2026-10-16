-- Page of published post ids, newest first, with the keyset cursor.
-- p_author_ids NULL = every author (Latest feed). Otherwise a post matches when
-- its owner OR an accepted co-author is in the list (profile, Following tab).
create function private.published_post_ids(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_exclude_id uuid,
  p_limit integer
)
returns table (post_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.posts p
  where p.status = 'published'
    and p.published_at is not null
    and (
      p_author_ids is null
      or p.author_id = any (p_author_ids)
      or exists (
        select 1
        from public.post_collaborators pc
        where pc.post_id = p.id
          and pc.status = 'accepted'
          and pc.user_id = any (p_author_ids)
      )
    )
    and (p_exclude_id is null or p.id <> p_exclude_id)
    and (p_after_at is null or (p.published_at, p.id) < (p_after_at, p_after_id))
  order by p.published_at desc, p.id desc
  limit least(greatest(p_limit, 1), 200);
$$;

create function public.get_published_post_ids(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_exclude_id uuid,
  p_limit integer
)
returns table (post_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.published_post_ids(
    p_author_ids, p_after_at, p_after_id, p_exclude_id, p_limit
  );
$$;

revoke all on function private.published_post_ids(uuid[], timestamptz, uuid, uuid, integer) from public;
revoke all on function public.get_published_post_ids(uuid[], timestamptz, uuid, uuid, integer) from public;
grant execute on function private.published_post_ids(uuid[], timestamptz, uuid, uuid, integer) to anon, authenticated;
grant execute on function public.get_published_post_ids(uuid[], timestamptz, uuid, uuid, integer) to anon, authenticated;