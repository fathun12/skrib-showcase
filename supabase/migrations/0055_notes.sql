-- 0055: Notes (short public posts). Tables, RLS, suspension policies,
-- indexes, rate limits and the reply-policy helper.
-- Reports are written by a function (0056), never directly by the browser.

begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values
  ('note_create', 30, 3600),
  ('note_delete', 60, 3600),
  ('note_like', 120, 600),
  ('note_report', 10, 3600);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  body text not null,
  reply_to_id uuid references public.notes (id) on delete cascade,
  shared_post_id uuid references public.posts (id) on delete set null,
  reply_policy text not null default 'everyone',
  status text not null default 'published',
  created_at timestamptz not null default now(),
  constraint notes_body_len check (char_length(body) between 1 and 500),
  constraint notes_body_not_blank check (char_length(btrim(body)) >= 1),
  constraint notes_reply_policy_valid
    check (reply_policy in ('everyone', 'following', 'nobody')),
  constraint notes_status_valid
    check (status in ('published', 'hidden', 'hidden_by_author'))
);

create index notes_author_created_idx
  on public.notes (author_id, created_at desc);
create index notes_reply_idx
  on public.notes (reply_to_id, created_at) where reply_to_id is not null;
create index notes_feed_idx
  on public.notes (created_at desc, id desc)
  where status = 'published' and reply_to_id is null;

create table public.note_likes (
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, note_id)
);

create index note_likes_note_idx on public.note_likes (note_id);

-- The report SURVIVES the note and its reporter (evidence rules, NOTES_SPEC 2b).
create table public.note_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid()
    references public.profiles (id) on delete set null,
  note_id uuid references public.notes (id) on delete set null,
  snapshot jsonb not null,
  retain_until timestamptz,
  legal_hold boolean not null default false,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint note_reports_reason_valid
    check (reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  constraint note_reports_details_length
    check (details is null or (char_length(details) >= 1 and char_length(details) <= 500)),
  constraint note_reports_status_valid
    check (status in ('open', 'resolved', 'dismissed')),
  constraint note_reports_one_per_user unique (reporter_id, note_id)
);

create index note_reports_note_idx on public.note_reports (note_id);
create index note_reports_status_idx on public.note_reports (status, created_at desc);

alter table public.notes enable row level security;
alter table public.note_likes enable row level security;
alter table public.note_reports enable row level security;

revoke all on public.notes, public.note_likes, public.note_reports
  from anon, authenticated;

-- Notes: public reads published ones, the author also sees their own hidden ones.
grant select on public.notes to anon, authenticated;
grant insert (body, reply_to_id, reply_policy) on public.notes to authenticated;
grant update (reply_policy) on public.notes to authenticated;
grant delete on public.notes to authenticated;

grant select on public.note_likes to anon, authenticated;
grant insert (note_id), delete on public.note_likes to authenticated;

-- note_reports: no grants and no policies on purpose (functions only).

-- Reply policy: may p_replier reply to note p_parent? Security definer so it
-- can read the parent and the follows table whatever the caller can see.
create function private.can_reply_to_note(p_parent uuid, p_replier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.notes n
     where n.id = p_parent
       and n.status = 'published'
       and (
         n.author_id = p_replier
         or n.reply_policy = 'everyone'
         or (
           n.reply_policy = 'following'
           and exists (
             select 1 from public.follows f
              where f.follower_id = n.author_id
                and f.following_id = p_replier
           )
         )
       )
  );
$$;

revoke all on function private.can_reply_to_note(uuid, uuid) from public, anon;
grant execute on function private.can_reply_to_note(uuid, uuid) to authenticated;

create policy "published notes are public"
  on public.notes for select
  to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));

create policy "authors create their own notes"
  on public.notes for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      reply_to_id is null
      or private.can_reply_to_note(reply_to_id, author_id)
    )
  );

create policy "authors change the reply policy of their own notes"
  on public.notes for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete their own notes"
  on public.notes for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "note likes are public"
  on public.note_likes for select
  to anon, authenticated
  using (true);

create policy "users like visible notes"
  on public.note_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.notes n where n.id = note_likes.note_id)
  );

create policy "users remove their own note likes"
  on public.note_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- A suspended account cannot write or like; deleting its own notes and
-- removing likes stay allowed (the report snapshot protects the evidence).
create policy suspended_no_insert_notes on public.notes
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));

create policy suspended_no_update_notes on public.notes
  as restrictive for update to authenticated
  using (not (select private.is_suspended()))
  with check (not (select private.is_suspended()));

create policy suspended_no_insert_note_likes on public.note_likes
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));

commit;