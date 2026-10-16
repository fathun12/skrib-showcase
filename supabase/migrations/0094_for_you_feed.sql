create or replace function public.get_for_you_post_ids(p_days integer, p_limit integer)
 returns table(post_id uuid)
 language sql
 stable
 set search_path to ''
as $function$
  with me as (
    select auth.uid() as uid
  ),
  seen as (
    select l.post_id from public.likes l join me on l.user_id = me.uid
    union
    select b.post_id from public.bookmarks b join me on b.user_id = me.uid
    union
    select r.post_id from public.reading_progress r join me on r.user_id = me.uid
    where r.progress >= 0.9
  ),
  signal_posts as (
    select l.post_id, 3 as w from public.likes l join me on l.user_id = me.uid
    union all
    select b.post_id, 3 as w from public.bookmarks b join me on b.user_id = me.uid
    union all
    select r.post_id, 1 as w from public.reading_progress r join me on r.user_id = me.uid
    where r.progress >= 0.5
  ),
  tag_w as (
    select x.tag, sum(x.w) as w
    from (
      select t.tag, sp.w
      from signal_posts sp
      join public.posts p on p.id = sp.post_id
      cross join lateral unnest(p.tags) as t(tag)
      union all
      select tf.tag, 4 as w
      from public.tag_follows tf join me on tf.user_id = me.uid
    ) x
    group by x.tag
  ),
  author_w as (
    select x.author_id, sum(x.w) as w
    from (
      select p.author_id, sp.w
      from signal_posts sp
      join public.posts p on p.id = sp.post_id
      union all
      select f.following_id as author_id, 5 as w
      from public.follows f join me on f.follower_id = me.uid
    ) x
    group by x.author_id
  ),
  scored as (
    select
      p.id,
      p.published_at,
      least(
        coalesce((select sum(tw.w) from tag_w tw where tw.tag = any (p.tags)), 0),
        12
      ) + coalesce((select aw.w from author_w aw where aw.author_id = p.author_id), 0) as rel
    from public.posts p
    join me on me.uid is not null
    where p.status = 'published'
      and p.author_id <> me.uid
      and p.published_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
      and not exists (select 1 from seen s where s.post_id = p.id)
  )
  select s.id
  from scored s
  where s.rel > 0
  order by
    s.rel / power(extract(epoch from (now() - s.published_at)) / 86400.0 + 2, 1.0) desc,
    s.published_at desc,
    s.id desc
  limit least(greatest(p_limit, 1), 100);
$function$;

revoke all on function public.get_for_you_post_ids(integer, integer) from public, anon;
grant execute on function public.get_for_you_post_ids(integer, integer) to authenticated;