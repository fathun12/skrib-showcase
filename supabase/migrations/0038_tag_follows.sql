-- 0038_tag_follows.sql
-- Run after 0037.
-- Following a topic (tag). PRIVATE like bookmarks: a user can only see, add
-- and remove their own rows. Also the Topics feed function for the home tab.

begin;

create table public.tag_follows (
  -- Filled by the database from the session; the app never sends it.
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, tag),
  -- One element of posts.tags (migration 0036, src/ui/tags.ts): 2 to 30
  -- characters of a-z, 0-9 and hyphens, no hyphen at either end.
  constraint tag_follows_tag_format
    check (tag ~ '^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$')
);

alter table public.tag_follows enable row level security;

-- Start from nothing, then grant exactly what is needed.
revoke all on public.tag_follows from anon, authenticated;
grant select on public.tag_follows to authenticated;
grant insert (tag) on public.tag_follows to authenticated;
grant delete on public.tag_follows to authenticated;

create policy "tag_follows_select_own"
  on public.tag_follows
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "tag_follows_insert_own"
  on public.tag_follows
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "tag_follows_delete_own"
  on public.tag_follows
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- A cap that a policy cannot express: at most 50 followed topics per person.
create function private.check_tag_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.tag_follows f
      where f.user_id = new.user_id) >= 50 then
    raise exception 'tag_follow_limit';
  end if;
  return new;
end;
$$;

revoke all on function private.check_tag_follow_insert() from public;

create trigger check_tag_follow_insert
  before insert on public.tag_follows
  for each row execute function private.check_tag_follow_insert();

-- The Topics tab: published posts that have at least one topic the caller
-- follows, newest first, keyset order (published_at, id) like the home feed.
-- security invoker: RLS shows only the caller's own follows and published
-- posts. The status filter is repeated so the partial index posts_tags_idx
-- (published only) can be used.
create function public.get_topics_feed(
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (post_id uuid, event_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.published_at
  from public.posts p
  where p.status = 'published'
    and p.published_at is not null
    and p.tags && coalesce(
      (select array_agg(f.tag)
       from public.tag_follows f
       where f.user_id = (select auth.uid())),
      '{}'::text[]
    )
    and (p_after_at is null
         or (p.published_at, p.id) < (p_after_at, p_after_id))
  order by p.published_at desc, p.id desc
  limit least(greatest(p_limit, 1), 200)
$$;

revoke all on function public.get_topics_feed(timestamptz, uuid, integer) from public;
grant execute on function public.get_topics_feed(timestamptz, uuid, integer) to authenticated;

-- Rate limit rule (migration 0007): 120 follows or unfollows an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('tag_follow', 120, 3600)
on conflict (action) do nothing;

commit;