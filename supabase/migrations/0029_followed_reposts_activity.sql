-- 0029_followed_reposts_activity.sql
-- Run after 0028.
-- News for the Following dot, the bell and the notifications page: stories
-- newly published by people I follow AND stories newly reposted by people I
-- follow, one row per story (a story that is both counts once).
-- Computed on read, so un-repost and repost again rings again.

begin;

-- event_at = the later of the publish time (followed author) and the newest
-- repost by a followed person; reposter_id is set only when the repost is the
-- winning event. Skips stories I wrote or co-wrote. security invoker: RLS
-- still applies.
create function public.get_my_new_activity(p_since timestamptz, p_limit int)
returns table (post_id uuid, event_at timestamptz, reposter_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  with originals as (
    select p.id as post_id, p.published_at as at
    from public.posts p
    join public.follows f
      on f.following_id = p.author_id
     and f.follower_id = auth.uid()
    where p.status = 'published'
      and p.published_at > greatest(p_since, f.created_at)
  ),
  new_reposts as (
    select distinct on (r.post_id) r.post_id, r.created_at as at, r.user_id
    from public.reposts r
    join public.follows f
      on f.following_id = r.user_id
     and f.follower_id = auth.uid()
    join public.posts p
      on p.id = r.post_id
     and p.status = 'published'
    where r.created_at > greatest(p_since, f.created_at)
      and p.author_id <> auth.uid()
      and not private.is_accepted_coauthor(p.id)
    order by r.post_id, r.created_at desc
  ),
  merged as (
    select
      coalesce(o.post_id, nr.post_id) as post_id,
      case when nr.at is not null and (o.at is null or nr.at > o.at)
           then nr.at else o.at end as event_at,
      case when nr.at is not null and (o.at is null or nr.at > o.at)
           then nr.user_id else null end as reposter_id
    from originals o
    full join new_reposts nr on nr.post_id = o.post_id
  )
  select m.post_id, m.event_at, m.reposter_id
  from merged m
  order by m.event_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_my_new_activity(timestamptz, int) from public, anon;
grant execute on function public.get_my_new_activity(timestamptz, int) to authenticated;

commit;