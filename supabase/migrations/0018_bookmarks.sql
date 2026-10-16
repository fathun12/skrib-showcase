-- 0018_bookmarks.sql
-- Run after 0017.
-- Saved posts (ecosystem stage A). PRIVATE: a user can only see, add and
-- remove their own rows. Nobody else can read who saved what.

begin;

create table public.bookmarks (
  -- Filled by the database from the session; the app never sends it.
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- The saved list: my rows, newest first.
create index bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);
-- Needed when a post is deleted (cascade looks rows up by post_id).
create index bookmarks_post_id_idx on public.bookmarks (post_id);

alter table public.bookmarks enable row level security;

-- Start from nothing, then grant exactly what is needed.
revoke all on public.bookmarks from anon, authenticated;
grant select on public.bookmarks to authenticated;
grant insert (post_id) on public.bookmarks to authenticated;
grant delete on public.bookmarks to authenticated;

create policy "bookmarks_select_own"
  on public.bookmarks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "bookmarks_insert_own"
  on public.bookmarks
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.status = 'published'
    )
  );

create policy "bookmarks_delete_own"
  on public.bookmarks
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Rate limit rule (migration 0007): 120 saves or unsaves an hour per user.
-- Editable later in the Table Editor (private.rate_limit_rules).
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('bookmark', 120, 3600)
on conflict (action) do nothing;

commit;