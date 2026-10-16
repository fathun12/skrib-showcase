-- 0020_popular_posts.sql
-- Run after 0019.
-- Ranked list for the Popular tab (ecosystem stage C): likes with time decay.
--   score = (likes + 1) / (age_in_hours + 2) ^ 1.5
-- The "+ 1" gives a brand new post with no likes a chance (cold start).
--
-- security invoker: runs with the caller's rights, so RLS still decides what
-- can be read. search_path is emptied like in 0004.

begin;

create function public.get_popular_post_ids(p_days int, p_limit int)
returns table (post_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id
  from public.posts p
  cross join lateral (
    select count(*) as n
    from public.likes l
    where l.post_id = p.id
  ) lk
  where p.status = 'published'
    and p.published_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
  order by
    (lk.n + 1) / power(extract(epoch from (now() - p.published_at)) / 3600.0 + 2, 1.5) desc,
    p.published_at desc,
    p.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_popular_post_ids(int, int) from public;
grant execute on function public.get_popular_post_ids(int, int) to anon, authenticated;

commit;