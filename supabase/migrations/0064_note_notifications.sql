-- 0064: bell notifications for notes (note_reply, note_like)

alter table public.notifications
  add column note_id uuid references public.notes (id) on delete cascade;

grant select (note_id) on public.notifications to authenticated;

alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type = any (array[
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like'
  ]::text[]));

-- A note notification must name its note, and no other type may.
alter table public.notifications add constraint notifications_note_matches_type
  check ((type = any (array['note_reply', 'note_like']::text[])) = (note_id is not null));

drop index public.notifications_dedupe_idx;
create unique index notifications_dedupe_idx on public.notifications
  (recipient_id, actor_id, type,
   coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(note_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index notifications_note_idx on public.notifications (note_id)
  where note_id is not null;

-- A reply notifies the author of the note it replies to (not for own replies).
-- note_id is the REPLY, so the row opens the reply and its thread.
create function private.notify_on_note_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_parent_author uuid;
begin
  if new.reply_to_id is null or new.status <> 'published' then
    return new;
  end if;

  select n.author_id into v_parent_author
  from public.notes n
  where n.id = new.reply_to_id;

  if v_parent_author is not null and v_parent_author <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, type, note_id)
    values (v_parent_author, new.author_id, 'note_reply', new.id)
    on conflict do nothing;
  end if;
  return new;
end;
$fn$;

-- A like notifies the author of the note (not for own likes).
create function private.notify_on_note_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_author uuid;
  v_status text;
begin
  select n.author_id, n.status into v_author, v_status
  from public.notes n
  where n.id = new.note_id;

  if v_author is not null and v_status = 'published' and v_author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, note_id)
    values (v_author, new.user_id, 'note_like', new.note_id)
    on conflict do nothing;
  end if;
  return new;
end;
$fn$;

revoke all on function private.notify_on_note_reply() from public, anon, authenticated;
revoke all on function private.notify_on_note_like() from public, anon, authenticated;

create trigger notify_on_note_reply
  after insert on public.notes
  for each row execute function private.notify_on_note_reply();

create trigger notify_on_note_like
  after insert on public.note_likes
  for each row execute function private.notify_on_note_like();