-- Credit notifications, part 2: "accepted" for the owner, and a re-invite
-- rings the bell again.

alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications
  add constraint notifications_type_valid
    check (type in ('follow', 'like', 'comment', 'reply', 'repost', 'credit', 'credit_accepted'));
alter table public.notifications
  add constraint notifications_post_matches_type
    check ((type in ('like', 'comment', 'reply', 'repost', 'credit', 'credit_accepted')) = (post_id is not null));

-- ---------- accepted: tell the post owner ----------
create function private.notify_on_credit_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null
     and old.status = 'pending'
     and new.status = 'accepted' then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (new.invited_by, new.user_id, 'credit_accepted', new.post_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_on_credit_accepted() from public;

create trigger notify_on_credit_accepted
  after update of status on public.post_credits
  for each row execute function private.notify_on_credit_accepted();

-- ---------- declined or removed: clear the bell rows ----------
create function private.clear_credit_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id is not null then
    delete from public.notifications n
     where n.post_id = old.post_id
       and (
         (n.type = 'credit'
          and n.recipient_id = old.user_id
          and n.actor_id = old.invited_by)
         or
         (n.type = 'credit_accepted'
          and n.recipient_id = old.invited_by
          and n.actor_id = old.user_id)
       );
  end if;
  return old;
end;
$$;

revoke all on function private.clear_credit_notifications() from public;

create trigger clear_credit_notifications
  after delete on public.post_credits
  for each row execute function private.clear_credit_notifications();

-- One-off cleanup of old test rows: a "credit" notification whose credit no
-- longer exists would block the next invitation of the same person.
delete from public.notifications n
 where n.type = 'credit'
   and not exists (
     select 1 from public.post_credits c
      where c.user_id = n.recipient_id and c.post_id = n.post_id
   );