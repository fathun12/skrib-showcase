-- 0008_reports.sql
-- Run after 0007.
-- Reports on posts (spec step 19d). A signed-in user can only INSERT a report;
-- nobody reads reports through the API. The owner reads them in the Supabase
-- Table Editor, which bypasses RLS.

begin;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Filled by the database from the session; the app never sends it.
  reporter_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  reason text not null,
  -- NULL when there is no note, never '' (same rule as the URL columns).
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_reason_valid
    check (reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  constraint reports_details_length
    check (details is null or char_length(details) between 1 and 500),
  constraint reports_status_valid
    check (status in ('open', 'resolved', 'dismissed')),
  -- One report per person per post.
  constraint reports_one_per_user unique (reporter_id, post_id)
);

create index reports_post_id_idx on public.reports (post_id);
create index reports_status_created_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

-- Decision 22: start from nothing, then grant exactly what is needed.
-- INSERT is granted per column, so a user can never set status, id or
-- created_at, and cannot send a reporter_id of their own.
revoke all on public.reports from anon, authenticated;
grant insert (post_id, reason, details) on public.reports to authenticated;

-- No select, update or delete policy on purpose: nobody reads, edits or
-- removes reports through the API.
create policy "reports_insert_own"
  on public.reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.status = 'published'
        and p.author_id <> (select auth.uid())
    )
  );

-- Rate limit rule (migration 0007): 10 reports an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('report', 10, 3600)
on conflict (action) do nothing;

commit;