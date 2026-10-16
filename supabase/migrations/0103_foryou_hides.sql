create table public.foryou_hides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete cascade,
  tag text,
  created_at timestamptz not null default now(),
  constraint foryou_hides_one_target check ((author_id is not null)::int + (tag is not null)::int = 1),
  constraint foryou_hides_not_self check (author_id is null or author_id <> user_id),
  constraint foryou_hides_tag_format check (tag is null or (tag ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(tag) between 2 and 30))
);

create unique index foryou_hides_author_uidx on public.foryou_hides (user_id, author_id) where author_id is not null;
create unique index foryou_hides_tag_uidx on public.foryou_hides (user_id, tag) where tag is not null;

alter table public.foryou_hides enable row level security;

revoke all on public.foryou_hides from anon, authenticated;
grant select, delete on public.foryou_hides to authenticated;
grant insert (author_id, tag) on public.foryou_hides to authenticated;

create policy foryou_hides_select_own on public.foryou_hides
  for select to authenticated using (user_id = auth.uid());
create policy foryou_hides_insert_own on public.foryou_hides
  for insert to authenticated with check (user_id = auth.uid());
create policy foryou_hides_delete_own on public.foryou_hides
  for delete to authenticated using (user_id = auth.uid());
create policy suspended_no_insert_foryou_hides on public.foryou_hides
  as restrictive for insert to authenticated with check (not private.is_suspended());

create function private.foryou_hides_check_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.foryou_hides where user_id = new.user_id) >= 100 then
    raise exception 'foryou_hide_limit' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.foryou_hides_check_limit() from public, anon, authenticated;

create trigger foryou_hides_check_limit
  before insert on public.foryou_hides
  for each row execute function private.foryou_hides_check_limit();

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
      and not exists (
        select 1 from public.foryou_hides h
        where h.user_id = me.uid
          and (h.author_id = p.author_id or h.tag = any (p.tags))
      )
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