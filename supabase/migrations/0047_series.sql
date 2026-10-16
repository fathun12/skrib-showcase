-- 0047: series. An author groups their own published posts into an ordered
-- collection. A post is in at most one series. Membership lives in its own
-- table so that the posts triggers and co-author guards are not touched.

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('create_series', 20, 3600), ('edit_series', 60, 3600);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint series_title_len check (char_length(title) between 1 and 80),
  constraint series_description_len
    check (description is null or char_length(description) <= 300),
  constraint series_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  unique (author_id, slug)
);

create table public.series_posts (
  post_id uuid primary key references public.posts (id) on delete cascade,
  series_id uuid not null references public.series (id) on delete cascade,
  position integer not null
);

create index series_posts_series_idx on public.series_posts (series_id, position);

alter table public.series enable row level security;
alter table public.series_posts enable row level security;

revoke all on public.series, public.series_posts from anon, authenticated;
grant select on public.series, public.series_posts to anon, authenticated;
grant insert, delete on public.series, public.series_posts to authenticated;
grant update (slug, title, description) on public.series to authenticated;
grant update (series_id, position) on public.series_posts to authenticated;

-- series: everyone reads, only the owner writes.
create policy "series are public"
  on public.series for select
  to anon, authenticated
  using (true);

create policy "authors create their own series"
  on public.series for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "authors update their own series"
  on public.series for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete their own series"
  on public.series for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- series_posts: a row is visible when the post itself is visible to the reader
-- (published posts for everyone, own drafts for the owner).
create policy "series posts follow post visibility"
  on public.series_posts for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p where p.id = series_posts.post_id
    )
  );

create policy "authors add their own posts to their own series"
  on public.series_posts for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.series s
        join public.posts p on p.author_id = s.author_id
       where s.id = series_posts.series_id
         and p.id = series_posts.post_id
         and s.author_id = (select auth.uid())
    )
  );

create policy "authors update their own series posts"
  on public.series_posts for update
  to authenticated
  using (
    exists (
      select 1 from public.series s
       where s.id = series_posts.series_id
         and s.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
        from public.series s
        join public.posts p on p.author_id = s.author_id
       where s.id = series_posts.series_id
         and p.id = series_posts.post_id
         and s.author_id = (select auth.uid())
    )
  );

create policy "authors remove posts from their own series"
  on public.series_posts for delete
  to authenticated
  using (
    exists (
      select 1 from public.series s
       where s.id = series_posts.series_id
         and s.author_id = (select auth.uid())
    )
  );

-- A suspended account cannot create or change series; removing and deleting
-- stay allowed, like deleting its own posts.
create policy suspended_no_insert_series on public.series
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));

create policy suspended_no_update_series on public.series
  as restrictive for update to authenticated
  using (not (select private.is_suspended()))
  with check (not (select private.is_suspended()));

create policy suspended_no_insert_series_posts on public.series_posts
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));

create policy suspended_no_update_series_posts on public.series_posts
  as restrictive for update to authenticated
  using (not (select private.is_suspended()))
  with check (not (select private.is_suspended()));