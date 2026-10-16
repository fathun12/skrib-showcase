-- 0023_reposts.sql
-- Run after 0022.
-- Reposts (first version, no caption). Public: anyone can see who reposted a
-- published post. A user adds and removes only own rows, and cannot repost
-- own posts or posts where they are an accepted co-author.

begin;

create table public.reposts (
  -- Filled by the database from the session; the app never sends it.
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- A person's repost list, newest first.
create index reposts_user_created_idx
  on public.reposts (user_id, created_at desc);
-- Counts per post, and the cascade when a post is deleted.
create index reposts_post_id_idx on public.reposts (post_id);

alter table public.reposts enable row level security;

revoke all on public.reposts from anon, authenticated;
grant select on public.reposts to anon, authenticated;
grant insert (post_id) on public.reposts to authenticated;
grant delete on public.reposts to authenticated;

create policy "reposts_select_published"
  on public.reposts for select to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create policy "reposts_insert_own"
  on public.reposts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
    and not private.is_post_owner(post_id)
    and not private.is_accepted_coauthor(post_id)
  );

create policy "reposts_delete_own"
  on public.reposts for delete to authenticated
  using (user_id = (select auth.uid()));

-- Repost counts for many posts in one query (the post cards). Posts without
-- reposts are absent from the result: treat them as 0.
create function public.get_repost_counts(post_ids uuid[])
returns table (post_id uuid, repost_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.post_id, count(*)::bigint as repost_count
  from public.reposts r
  where r.post_id = any (post_ids)
  group by r.post_id;
$$;

revoke all on function public.get_repost_counts(uuid[]) from public;
grant execute on function public.get_repost_counts(uuid[]) to anon, authenticated;

-- Rate limit rule: 120 reposts or un-reposts an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('repost', 120, 3600)
on conflict (action) do nothing;

commit;