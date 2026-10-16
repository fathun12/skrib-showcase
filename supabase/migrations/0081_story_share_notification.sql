-- 0081_story_share_notification.sql
-- Bell notification to the author of a story when someone shares it to a note
-- (type story_share). note_id = the NEW note that shares the story, so the row
-- opens that note. Once per person per story, never for yourself, none when
-- the story author blocked the sharer in Notes. Muting is applied when the
-- list is read (same as the other note events).

begin;

alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type = any (array[
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like',
    'note_mention', 'note_repost', 'note_quote', 'story_share'
  ]::text[]));

alter table public.notifications drop constraint notifications_note_matches_type;
alter table public.notifications add constraint notifications_note_matches_type
  check ((type = any (array[
           'note_reply', 'note_like', 'note_mention', 'note_repost',
           'note_quote', 'story_share'
         ]::text[]))
         = (note_id is not null));

create function private.notify_on_story_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_author uuid;
begin
  if new.shared_post_id is null or new.status <> 'published' then
    return new;
  end if;

  select p.author_id into v_author
  from public.posts p
  where p.id = new.shared_post_id and p.status = 'published';

  if v_author is null or v_author = new.author_id then
    return new;
  end if;

  -- The story author blocked the sharer in Notes: no bell.
  if exists (
    select 1 from public.note_blocks b
    where b.blocker_id = v_author and b.blocked_id = new.author_id
  ) then
    return new;
  end if;

  -- Once per person per story: a second share by the same person is silent.
  if exists (
    select 1
    from public.notifications nf
    join public.notes sn on sn.id = nf.note_id
    where nf.type = 'story_share'
      and nf.recipient_id = v_author
      and nf.actor_id = new.author_id
      and sn.shared_post_id = new.shared_post_id
  ) then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, note_id)
  values (v_author, new.author_id, 'story_share', new.id)
  on conflict do nothing;
  return new;
end;
$fn$;

revoke all on function private.notify_on_story_share()
  from public, anon, authenticated;

create trigger notify_on_story_share
  after insert on public.notes
  for each row execute function private.notify_on_story_share();

commit;