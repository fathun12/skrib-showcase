-- 0051_highlights.sql
-- Run after 0050.
-- Reader highlights: a signed-in reader marks a passage of a published story.
-- PRIVATE: a person sees and changes only their own rows (nobody else, not
-- even the author). A passage is found again by its block number, its
-- character range inside that block and the quoted text.
-- One highlight lives inside ONE block (paragraph or heading).

begin;

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  -- Filled by the database from the session; the app never sends it.
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  block_index integer not null check (block_index >= 0 and block_index <= 5000),
  start_offset integer not null check (start_offset >= 0),
  end_offset integer not null,
  quote text not null check (char_length(quote) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (end_offset > start_offset),
  -- The same passage cannot be saved twice.
  unique (user_id, post_id, block_index, start_offset, end_offset)
);

create index highlights_user_post_idx on public.highlights (user_id, post_id);
-- The cascade when a post is deleted.
create index highlights_post_id_idx on public.highlights (post_id);

alter table public.highlights enable row level security;

revoke all on public.highlights from anon, authenticated;
grant select on public.highlights to authenticated;
grant insert (post_id, block_index, start_offset, end_offset, quote)
  on public.highlights to authenticated;
grant delete on public.highlights to authenticated;

create policy "highlights_select_own"
  on public.highlights for select to authenticated
  using (user_id = (select auth.uid()));

create policy "highlights_insert_own"
  on public.highlights for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create policy "highlights_delete_own"
  on public.highlights for delete to authenticated
  using (user_id = (select auth.uid()));

-- A suspended account cannot add highlights (deleting stays allowed).
create policy "suspended_no_insert_highlights"
  on public.highlights as restrictive for insert to authenticated
  with check (not private.is_suspended());

-- At most 200 highlights per person and story.
create function private.check_highlight_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    select count(*) from public.highlights h
    where h.user_id = new.user_id and h.post_id = new.post_id
  ) >= 200 then
    raise exception 'highlight_limit' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger highlights_check_limit
  before insert on public.highlights
  for each row execute function private.check_highlight_limit();

-- Rate limit rule: 300 adds or removals an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('highlight', 300, 3600)
on conflict (action) do nothing;

commit;