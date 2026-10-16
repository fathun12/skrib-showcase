-- 0027_repost_caption.sql
-- Run after 0026.
-- Repost caption: an optional note (1 to 280 characters) on a repost, which
-- its owner can edit or remove. Plus a table for reports on captions.

begin;

-- 1) The caption column. NULL = a repost without caption.
alter table public.reposts add column caption text;

alter table public.reposts
  add constraint reposts_caption_length
    check (caption is null or char_length(btrim(caption)) between 1 and 280);

-- 2) Rights. Insert may now carry a caption; update is allowed on the
-- caption column only (user_id, post_id and created_at can never change).
grant insert (caption) on public.reposts to authenticated;
grant update (caption) on public.reposts to authenticated;

create policy "reposts_update_own"
  on public.reposts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 3) Reports on captions (separate from reports and comment_reports).
create table public.repost_caption_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  repost_user_id uuid not null,
  post_id uuid not null,
  -- Filled by the trigger below, never by the app.
  caption_text text not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint repost_caption_reports_repost_fk
    foreign key (repost_user_id, post_id)
    references public.reposts (user_id, post_id) on delete cascade,
  constraint repost_caption_reports_reason_valid
    check (reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  constraint repost_caption_reports_details_length
    check (details is null or char_length(details) between 1 and 500),
  constraint repost_caption_reports_status_valid
    check (status in ('open', 'resolved', 'dismissed')),
  constraint repost_caption_reports_one_per_user
    unique (reporter_id, repost_user_id, post_id)
);

create index repost_caption_reports_status_created_idx
  on public.repost_caption_reports (status, created_at desc);

alter table public.repost_caption_reports enable row level security;
revoke all on public.repost_caption_reports from anon, authenticated;
grant insert (repost_user_id, post_id, reason, details)
  on public.repost_caption_reports to authenticated;

-- Copies the caption as it is at the moment of the report.
create function private.fill_repost_caption_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select r.caption into new.caption_text
  from public.reposts r
  where r.user_id = new.repost_user_id
    and r.post_id = new.post_id;

  if new.caption_text is null then
    raise exception 'repost_caption_not_found';
  end if;
  return new;
end;
$$;

revoke all on function private.fill_repost_caption_report() from public;

create trigger fill_repost_caption_report
  before insert on public.repost_caption_reports
  for each row execute function private.fill_repost_caption_report();

-- Nobody reads reports through the API; read them in the Table Editor.
create policy "repost_caption_reports_insert_own"
  on public.repost_caption_reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and repost_user_id <> (select auth.uid())
    and exists (
      select 1
      from public.reposts r
      join public.posts p on p.id = r.post_id
      where r.user_id = repost_user_id
        and r.post_id = repost_caption_reports.post_id
        and r.caption is not null
        and p.status = 'published'
    )
  );

commit;