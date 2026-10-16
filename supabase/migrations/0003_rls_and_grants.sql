-- 0003_rls_and_grants.sql
-- Run after 0002.
--
-- Two layers of security:
--   1. GRANT  = which roles may touch a table at all. Supabase no longer
--               grants this automatically on new tables, so it is explicit here.
--   2. RLS    = which ROWS each role may touch.
-- service_role is intentionally not granted anything: the app should not need it.

-- ---------- GRANTS ----------
grant select on public.profiles, public.posts, public.follows, public.likes
  to anon, authenticated;

-- Column-level: users can edit only these profile columns (never id/created_at).
grant update (username, display_name, bio, avatar_url)
  on public.profiles to authenticated;

grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.follows to authenticated;
grant insert, delete on public.likes to authenticated;

-- ---------- ENABLE RLS ----------
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;

-- ---------- profiles ----------
create policy "profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------- posts ----------
create policy "published posts are public"
  on public.posts for select
  to anon, authenticated
  using (status = 'published');

create policy "authors read their own posts"
  on public.posts for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "authors create their own posts"
  on public.posts for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "authors update their own posts"
  on public.posts for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete their own posts"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ---------- follows ----------
create policy "follows are public"
  on public.follows for select
  to anon, authenticated
  using (true);

create policy "users follow as themselves"
  on public.follows for insert
  to authenticated
  with check (follower_id = (select auth.uid()));

create policy "users unfollow as themselves"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

-- ---------- likes ----------
create policy "likes are public"
  on public.likes for select
  to anon, authenticated
  using (true);

-- A like is only allowed on a published post.
create policy "users like as themselves"
  on public.likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create policy "users unlike as themselves"
  on public.likes for delete
  to authenticated
  using (user_id = (select auth.uid()));