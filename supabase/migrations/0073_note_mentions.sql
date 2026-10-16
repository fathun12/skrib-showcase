-- 0073_note_mentions.sql
-- Mentions in notes: note_mentions is filled by a trigger from the note text
-- (max 5 distinct existing usernames, never self, never a person who blocked
-- the author), a new notification type note_mention and a rate-limit rule
-- for the suggestion box.

begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('note_mention_suggest', 60, 60);

-- First 5 distinct @usernames of a text, in order of appearance. Keep in sync
-- with MENTION_PATTERN in src/ui/notes/NoteBody.tsx. Usernames are 3 to 30
-- characters of a-z, 0-9, _ and - (src/lib/constants).
create function private.extract_note_mentions(p_body text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(f.name order by f.first_pos), '{}'::text[])
  from (
    select (m.arr)[1] as name, min(m.ord) as first_pos
    from regexp_matches(
           lower(coalesce(p_body, '')),
           '(?:^|[^[:alnum:]_&/@-])@([a-z0-9_-]{3,30})(?![[:alnum:]_-])',
           'g'
         ) with ordinality as m(arr, ord)
    group by (m.arr)[1]
    order by min(m.ord)
    limit 5
  ) f
$$;

create table public.note_mentions (
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (note_id, user_id)
);

create index note_mentions_user_idx on public.note_mentions (user_id);

alter table public.note_mentions enable row level security;

create policy "note mentions follow note visibility"
  on public.note_mentions for select
  using (exists (select 1 from public.notes n where n.id = note_mentions.note_id));

-- Nobody writes through the API: only the trigger below does.
revoke all on public.note_mentions from anon, authenticated;
grant select on public.note_mentions to anon, authenticated;

-- A mention notification names the note that mentions me.
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type = any (array[
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like',
    'note_mention'
  ]::text[]));

alter table public.notifications drop constraint notifications_note_matches_type;
alter table public.notifications add constraint notifications_note_matches_type
  check ((type = any (array['note_reply', 'note_like', 'note_mention']::text[]))
         = (note_id is not null));

create function private.sync_note_mentions()
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

  -- One notification per note and person (the unique index makes a repeat
  -- after an edit do nothing, so only NEW mentions notify). Not when the
  -- person muted the author, and not when the note is a reply to his own
  -- note (he already gets the reply notification).
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
    on conflict do nothing;
  end if;
  return null;
end;
$$;

revoke all on function private.extract_note_mentions(text)
  from public, anon, authenticated;
revoke all on function private.sync_note_mentions()
  from public, anon, authenticated;

create trigger notes_sync_mentions
  after insert or update of body
  on public.notes
  for each row execute function private.sync_note_mentions();

-- Backfill the notes that already exist (no notifications for old notes).
insert into public.note_mentions (note_id, user_id)
select n.id, p.id
from public.notes n
cross join lateral unnest(private.extract_note_mentions(n.body)) as x(name)
join public.profiles p on p.username = x.name
where p.id <> n.author_id
  and not exists (
    select 1 from public.note_blocks b
    where b.blocker_id = p.id and b.blocked_id = n.author_id
  )
on conflict do nothing;

commit;