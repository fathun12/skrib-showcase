-- 0022_following_state.sql
-- Run after 0021.
-- When the user last opened the Following tab (for the dot on that tab).
-- A separate table on purpose: notification_state belongs to the bell.

begin;

create table public.following_state (
  user_id uuid primary key default auth.uid()
    references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.following_state enable row level security;
revoke all on public.following_state from anon, authenticated;
grant select on public.following_state to authenticated;
grant insert (seen_at) on public.following_state to authenticated;
grant update (seen_at) on public.following_state to authenticated;

create policy "following_state_select_own"
  on public.following_state for select to authenticated
  using (user_id = (select auth.uid()));

create policy "following_state_insert_own"
  on public.following_state for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "following_state_update_own"
  on public.following_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Rate limit rule: marking Following as seen, 120 an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('following_seen', 120, 3600)
on conflict (action) do nothing;

commit;