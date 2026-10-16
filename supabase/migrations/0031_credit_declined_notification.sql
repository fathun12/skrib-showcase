-- 0031_credit_declined_notification.sql
-- Run after 0030.
-- The post owner is told when a person DECLINES a credit invitation
-- (new notification type 'credit_declined'). Only a decline of a pending
-- invitation counts: resigning from an accepted credit and removal by the
-- owner stay silent. A new invitation of the same person clears the old
-- declined row, so a second decline rings the bell again.

begin;

-- 1) Both constraints know the new type.
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications
  add constraint notifications_type_valid
    check (type in ('follow', 'like', 'comment', 'reply', 'repost',
                    'credit', 'credit_accepted', 'credit_declined'));
alter table public.notifications
  add constraint notifications_post_matches_type
    check ((type in ('like', 'comment', 'reply', 'repost',
                     'credit', 'credit_accepted', 'credit_declined'))
           = (post_id is not null));

-- 2) respond_credit (replaces the function of 0025): a decline also writes
-- the notification for the owner (after the delete, so the clearing trigger
-- of 0026 cannot remove it).
create or replace function private.respond_credit(p_credit_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_post uuid;
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if p_accept then
    update public.post_credits c
       set status = 'accepted', accepted_at = now()
     where c.id = p_credit_id
       and c.user_id = v_user
       and c.status = 'pending';
  else
    delete from public.post_credits c
     where c.id = p_credit_id
       and c.user_id = v_user
       and c.status = 'pending'
    returning c.post_id, c.invited_by into v_post, v_owner;
  end if;

  if not found then
    raise exception 'credit_not_found';
  end if;

  if not p_accept then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (v_owner, v_user, 'credit_declined', v_post)
    on conflict do nothing;
  end if;
end;
$$;

-- 3) A new invitation of the same person clears the old declined row.
create function private.clear_credit_declined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    delete from public.notifications n
     where n.type = 'credit_declined'
       and n.post_id = new.post_id
       and n.recipient_id = new.invited_by
       and n.actor_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function private.clear_credit_declined() from public;

create trigger clear_credit_declined
  after insert on public.post_credits
  for each row execute function private.clear_credit_declined();

commit;