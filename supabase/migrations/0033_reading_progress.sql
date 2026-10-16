-- 0033_reading_progress.sql
-- Run after 0032.
-- Continue reading: where a signed-in reader stopped in a published story.
-- Private: a person sees and changes only their own rows. Own stories and
-- stories where the person is an accepted co-author are never recorded.
-- Only 5% to 95% is stored: below that nothing is worth resuming, above that
-- the story counts as finished and the row is deleted (by the app).

begin;

create table public.reading_progress (
  -- Filled by the database from the session; the app never sends it.
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  progress real not null check (progress >= 0.05 and progress < 0.95),
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- "Continue reading" list: newest first.
create index reading_progress_user_updated_idx
  on public.reading_progress (user_id, updated_at desc);
-- The cascade when a post is deleted.
create index reading_progress_post_id_idx
  on public.reading_progress (post_id);

alter table public.reading_progress enable row level security;

revoke all on public.reading_progress from anon, authenticated;
grant select on public.reading_progress to authenticated;
grant insert (post_id, progress) on public.reading_progress to authenticated;
grant update (progress, updated_at) on public.reading_progress to authenticated;
grant delete on public.reading_progress to authenticated;

create policy "reading_progress_select_own"
  on public.reading_progress for select to authenticated
  using (user_id = (select auth.uid()));

create policy "reading_progress_insert_own"
  on public.reading_progress for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
    and not private.is_post_owner(post_id)
    and not private.is_accepted_coauthor(post_id)
  );

create policy "reading_progress_update_own"
  on public.reading_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "reading_progress_delete_own"
  on public.reading_progress for delete to authenticated
  using (user_id = (select auth.uid()));

-- One call that inserts or moves the place. Runs with the caller's rights,
-- so the policies above apply.
create function public.save_reading_progress(p_post_id uuid, p_progress real)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.reading_progress (post_id, progress)
  values (p_post_id, p_progress)
  on conflict (user_id, post_id)
  do update set progress = excluded.progress, updated_at = now();
$$;

revoke all on function public.save_reading_progress(uuid, real) from public, anon;
grant execute on function public.save_reading_progress(uuid, real) to authenticated;

-- Rate limit rule: 600 saves or removals an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('reading_progress', 600, 3600)
on conflict (action) do nothing;

commit;