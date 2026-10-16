-- 0074_note_reposts_quotes.sql
-- Reposts and quotes of notes: table note_reposts, notes.quote_note_id (and
-- quote_removed, set when the quoted note is deleted), rate-limit rule
-- note_repost, notification types note_repost and note_quote, the Following
-- feed with reposts, repost counts, and the quote in the report copy.

begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('note_repost', 60, 3600);

-- ---------------------------------------------------------------- quotes
alter table public.notes
  add column quote_note_id uuid references public.notes (id) on delete set null,
  add column quote_removed boolean not null default false;

-- A quote is not also a reply or a shared story; a removed quote has no id.
alter table public.notes add constraint notes_quote_exclusive
  check (quote_note_id is null
         or (reply_to_id is null and shared_post_id is null));
alter table public.notes add constraint notes_quote_removed_valid
  check (not (quote_removed and quote_note_id is not null));

create index notes_quote_idx on public.notes (quote_note_id)
  where quote_note_id is not null;

grant select (quote_note_id, quote_removed) on public.notes
  to anon, authenticated;
grant insert (quote_note_id) on public.notes to authenticated;

-- Everybody may quote a published note, except a person blocked by its author.
create function private.can_quote_note(p_quoted uuid, p_quoter uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notes n
    where n.id = p_quoted
      and n.status = 'published'
      and not exists (
        select 1 from public.note_blocks b
        where b.blocker_id = n.author_id and b.blocked_id = p_quoter
      )
  )
$$;

revoke all on function private.can_quote_note(uuid, uuid) from public, anon;
grant execute on function private.can_quote_note(uuid, uuid) to authenticated;

create policy "notes_quote_allowed"
  on public.notes as restrictive for insert
  with check (quote_note_id is null
              or private.can_quote_note(quote_note_id, author_id));

-- When a note is deleted, the quotes of it keep their text and are marked, so
-- the card can say "This note was deleted." (the foreign key then sets the id
-- to null).
create function private.mark_removed_quotes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notes set quote_removed = true where quote_note_id = old.id;
  return old;
end;
$$;

revoke all on function private.mark_removed_quotes()
  from public, anon, authenticated;

create trigger notes_mark_removed_quotes
  before delete on public.notes
  for each row execute function private.mark_removed_quotes();

-- --------------------------------------------------------------- reposts
create table public.note_reposts (
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, note_id)
);

create index note_reposts_note_idx on public.note_reposts (note_id);
create index note_reposts_user_idx
  on public.note_reposts (user_id, created_at desc);

alter table public.note_reposts enable row level security;

revoke all on public.note_reposts from anon, authenticated;
grant select on public.note_reposts to anon, authenticated;
grant insert (user_id, note_id) on public.note_reposts to authenticated;
grant delete on public.note_reposts to authenticated;

create policy "note reposts are public"
  on public.note_reposts for select
  using (true);

-- Only a published top-level note of somebody else.
create policy "users repost notes of others"
  on public.note_reposts for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notes n
      where n.id = note_reposts.note_id
        and n.status = 'published'
        and n.reply_to_id is null
        and n.author_id <> (select auth.uid())
    )
  );

create policy "note_reposts_not_blocked"
  on public.note_reposts as restrictive for insert
  with check (not private.note_blocked_by_author(note_id, user_id));

create policy "suspended_no_insert_note_reposts"
  on public.note_reposts as restrictive for insert
  with check (not (select private.is_suspended()));

create policy "users remove their own note reposts"
  on public.note_reposts for delete
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------- notifications
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type = any (array[
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like',
    'note_mention', 'note_repost', 'note_quote'
  ]::text[]));

alter table public.notifications drop constraint notifications_note_matches_type;
alter table public.notifications add constraint notifications_note_matches_type
  check ((type = any (array[
           'note_reply', 'note_like', 'note_mention', 'note_repost', 'note_quote'
         ]::text[]))
         = (note_id is not null));

-- note_id = the note that was reposted.
create function private.notify_on_note_repost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  select n.author_id into v_author
  from public.notes n
  where n.id = new.note_id and n.status = 'published';

  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, note_id)
    values (v_author, new.user_id, 'note_repost', new.note_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

-- note_id = the NEW note that quotes (it opens the quote).
create function private.notify_on_note_quote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  if new.quote_note_id is null or new.status <> 'published' then
    return new;
  end if;

  select n.author_id into v_author
  from public.notes n
  where n.id = new.quote_note_id;

  if v_author is not null and v_author <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, type, note_id)
    values (v_author, new.author_id, 'note_quote', new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_on_note_repost()
  from public, anon, authenticated;
revoke all on function private.notify_on_note_quote()
  from public, anon, authenticated;

create trigger notify_on_note_repost
  after insert on public.note_reposts
  for each row execute function private.notify_on_note_repost();

create trigger notify_on_note_quote
  after insert on public.notes
  for each row execute function private.notify_on_note_quote();

-- Same as 0073, plus: the author of the note that is quoted gets the quote
-- notification only, not a second one for the mention.
create or replace function private.sync_note_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.note_mentions where note_id = new.id;
  end if;

  insert into public.note_mentions (note_id, user_id)
  select new.id, p.id
  from public.profiles p
  where p.username = any (private.extract_note_mentions(new.body))
    and p.id <> new.author_id
    and not exists (
      select 1 from public.note_blocks b
      where b.blocker_id = p.id and b.blocked_id = new.author_id
    );

  if new.status = 'published' then
    insert into public.notifications (recipient_id, actor_id, type, note_id)
    select m.user_id, new.author_id, 'note_mention', new.id
    from public.note_mentions m
    where m.note_id = new.id
      and not exists (
        select 1 from public.note_mutes u
        where u.muter_id = m.user_id and u.muted_id = new.author_id
      )
      and not exists (
        select 1 from public.notes pn
        where pn.id = new.reply_to_id and pn.author_id = m.user_id
      )
      and not exists (
        select 1 from public.notes qn
        where qn.id = new.quote_note_id and qn.author_id = m.user_id
      )
    on conflict do nothing;
  end if;
  return null;
end;
$$;

-- ------------------------------------------------------------- functions
create function public.get_note_repost_counts(note_ids uuid[])
returns table (note_id uuid, repost_count bigint)
language sql
stable
set search_path = ''
as $$
  select r.note_id, count(*)::bigint
  from public.note_reposts r
  where r.note_id = any (note_ids)
  group by r.note_id
$$;

revoke all on function public.get_note_repost_counts(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_note_repost_counts(uuid[])
  to anon, authenticated;

-- The Following list: top-level notes of the given authors, plus notes of
-- other people that one of the given people reposted. A note shows once: as
-- its own (reposter_id null) when its author is in the list, otherwise with
-- the newest reposter. p_exclude = authors to leave out (muted, blocking).
create function public.get_following_note_feed(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit integer,
  p_exclude uuid[]
)
returns table (note_id uuid, activity_at timestamptz, reposter_id uuid)
language sql
stable
set search_path = ''
as $$
  with items as (
    select n.id as note_id, n.created_at as activity_at, null::uuid as reposter_id
    from public.notes n
    where n.author_id = any (p_author_ids)
      and n.status = 'published'
      and n.reply_to_id is null
    union all
    (select distinct on (r.note_id) r.note_id, r.created_at, r.user_id
     from public.note_reposts r
     join public.notes n on n.id = r.note_id
     where r.user_id = any (p_author_ids)
       and not (n.author_id = any (p_author_ids))
       and not (n.author_id = any (coalesce(p_exclude, '{}'::uuid[])))
       and n.status = 'published'
       and n.reply_to_id is null
     order by r.note_id, r.created_at desc)
  )
  select i.note_id, i.activity_at, i.reposter_id
  from items i
  where (i.activity_at, i.note_id) < (p_after_at, p_after_id)
  order by i.activity_at desc, i.note_id desc
  limit least(greatest(p_limit, 1), 200)
$$;

revoke all on function public.get_following_note_feed(
  uuid[], timestamptz, uuid, integer, uuid[]) from public, anon, authenticated;
grant execute on function public.get_following_note_feed(
  uuid[], timestamptz, uuid, integer, uuid[]) to authenticated;

-- ----------------------------------------------------------- report copy
-- Same as 0056, plus the quoted note (text and author) in the saved copy.
create or replace function private.report_note(
  p_note_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_details text := nullif(btrim(p_details), '');
  v_note record;
  v_parent jsonb;
  v_quote jsonb;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if p_reason not in ('spam', 'harassment', 'inappropriate', 'illegal', 'other') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 500 then
    raise exception 'invalid_details' using errcode = '22023';
  end if;

  select n.id, n.author_id, n.body, n.created_at, n.reply_to_id,
         n.quote_note_id, a.username
    into v_note
    from public.notes n
    join public.profiles a on a.id = n.author_id
   where n.id = p_note_id
     and n.status = 'published';

  if not found then
    raise exception 'note_not_found';
  end if;
  if v_note.author_id = v_user then
    raise exception 'own_note' using errcode = '22023';
  end if;

  select jsonb_build_object(
           'note_id', pn.id,
           'author_id', pn.author_id,
           'author_username', pa.username,
           'text', pn.body,
           'written_at', pn.created_at
         )
    into v_parent
    from public.notes pn
    join public.profiles pa on pa.id = pn.author_id
   where pn.id = v_note.reply_to_id;

  select jsonb_build_object(
           'note_id', qn.id,
           'author_id', qn.author_id,
           'author_username', qa.username,
           'text', qn.body,
           'written_at', qn.created_at
         )
    into v_quote
    from public.notes qn
    join public.profiles qa on qa.id = qn.author_id
   where qn.id = v_note.quote_note_id;

  insert into public.note_reports
    (reporter_id, note_id, snapshot, reason, details)
  values
    (v_user, v_note.id,
     jsonb_build_object(
       'note_id', v_note.id,
       'author_id', v_note.author_id,
       'author_username', v_note.username,
       'text', v_note.body,
       'written_at', v_note.created_at,
       'parent', v_parent,
       'quote', v_quote
     ),
     p_reason, v_details)
  on conflict (reporter_id, note_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

commit;