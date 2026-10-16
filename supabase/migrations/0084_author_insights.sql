-- 0084_author_insights.sql
-- Author insights, part 2: the numbers for /me/insights in ONE call.
-- Only the owner of a story (posts.author_id) sees its numbers: the wrapper
-- takes NO user id, it passes auth.uid(). Never returned: who viewed, liked,
-- saved or commented, and never any highlight count.

begin;

create function private.author_insights(p_user uuid, p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_from date;
  v_prev_from date;
  v_lower timestamptz;
  v_result jsonb;
begin
  if p_user is null or p_days is null or p_days not in (7, 30, 90) then
    raise exception 'invalid_insights_request' using errcode = '22023';
  end if;

  v_from := v_today - (p_days - 1);
  v_prev_from := v_from - p_days;
  v_lower := v_prev_from::timestamp at time zone 'Asia/Jakarta';

  with my_posts as (
    select p.id, p.title, p.slug, p.published_at
    from public.posts p
    where p.author_id = p_user and p.status = 'published'
  ),
  st as (
    select x.day, sum(x.views)::int as views, sum(x.reads)::int as reads
    from public.post_stats_daily x
    join my_posts mp on mp.id = x.post_id
    where x.day >= v_prev_from
    group by x.day
  ),
  lk as (
    select (l.created_at at time zone 'Asia/Jakarta')::date as day, count(*)::int as n
    from public.likes l
    join my_posts mp on mp.id = l.post_id
    where l.user_id <> p_user and l.created_at >= v_lower
    group by 1
  ),
  cm as (
    select (c.created_at at time zone 'Asia/Jakarta')::date as day, count(*)::int as n
    from public.comments c
    join my_posts mp on mp.id = c.post_id
    where c.author_id <> p_user and c.created_at >= v_lower
    group by 1
  ),
  sv as (
    select (b.created_at at time zone 'Asia/Jakarta')::date as day, count(*)::int as n
    from public.bookmarks b
    join my_posts mp on mp.id = b.post_id
    where b.user_id <> p_user and b.created_at >= v_lower
    group by 1
  ),
  fl as (
    select (f.created_at at time zone 'Asia/Jakarta')::date as day, count(*)::int as n
    from public.follows f
    where f.following_id = p_user and f.created_at >= v_lower
    group by 1
  ),
  daily as (
    select
      g.day,
      coalesce(st.views, 0) as views,
      coalesce(st.reads, 0) as reads,
      coalesce(lk.n, 0) as likes,
      coalesce(cm.n, 0) as comments,
      coalesce(sv.n, 0) as saves,
      coalesce(fl.n, 0) as followers
    from (
      select v_prev_from + i as day
      from generate_series(0, p_days * 2 - 1) as i
    ) g
    left join st on st.day = g.day
    left join lk on lk.day = g.day
    left join cm on cm.day = g.day
    left join sv on sv.day = g.day
    left join fl on fl.day = g.day
  ),
  sp as (
    select x.post_id, sum(x.views)::int as views, sum(x.reads)::int as reads
    from public.post_stats_daily x
    join my_posts mp on mp.id = x.post_id
    where x.day >= v_from
    group by x.post_id
  ),
  pl as (
    select l.post_id, count(*)::int as n
    from public.likes l
    join my_posts mp on mp.id = l.post_id
    where l.user_id <> p_user
      and (l.created_at at time zone 'Asia/Jakarta')::date >= v_from
    group by l.post_id
  ),
  pc as (
    select c.post_id, count(*)::int as n
    from public.comments c
    join my_posts mp on mp.id = c.post_id
    where c.author_id <> p_user
      and (c.created_at at time zone 'Asia/Jakarta')::date >= v_from
    group by c.post_id
  ),
  ps as (
    select b.post_id, count(*)::int as n
    from public.bookmarks b
    join my_posts mp on mp.id = b.post_id
    where b.user_id <> p_user
      and (b.created_at at time zone 'Asia/Jakarta')::date >= v_from
    group by b.post_id
  ),
  stories as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'title', t.title,
          'slug', t.slug,
          'published_at', t.published_at,
          'views', t.views,
          'reads', t.reads,
          'likes', t.likes,
          'comments', t.comments,
          'saves', t.saves
        )
        order by t.published_at desc
      ),
      '[]'::jsonb
    ) as j
    from (
      select
        mp.id, mp.title, mp.slug, mp.published_at,
        coalesce(sp.views, 0) as views,
        coalesce(sp.reads, 0) as reads,
        coalesce(pl.n, 0) as likes,
        coalesce(pc.n, 0) as comments,
        coalesce(ps.n, 0) as saves
      from my_posts mp
      left join sp on sp.post_id = mp.id
      left join pl on pl.post_id = mp.id
      left join pc on pc.post_id = mp.id
      left join ps on ps.post_id = mp.id
      order by mp.published_at desc
      limit 200
    ) t
  )
  select jsonb_build_object(
    'days', (
      select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb)
      from daily d
      where d.day >= v_from
    ),
    'previous', (
      select jsonb_build_object(
        'views', coalesce(sum(d.views), 0),
        'reads', coalesce(sum(d.reads), 0),
        'likes', coalesce(sum(d.likes), 0),
        'comments', coalesce(sum(d.comments), 0),
        'saves', coalesce(sum(d.saves), 0),
        'followers', coalesce(sum(d.followers), 0)
      )
      from daily d
      where d.day < v_from
    ),
    'stories', (select j from stories)
  )
  into v_result;

  return v_result;
end;
$fn$;

revoke all on function private.author_insights(uuid, integer) from public, anon;
grant execute on function private.author_insights(uuid, integer) to authenticated;

create function public.get_author_insights(p_days integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.author_insights(auth.uid(), p_days);
$$;

revoke all on function public.get_author_insights(integer) from public, anon;
grant execute on function public.get_author_insights(integer) to authenticated;

commit;