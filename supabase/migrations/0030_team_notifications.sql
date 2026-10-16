-- 0030_team_notifications.sql
-- Run after 0029.
-- Likes, new comments and reposts on a story now notify the owner AND every
-- accepted co-author (before: the owner only). Replies still go to the
-- author of the comment that was replied to. Nobody is notified about their
-- own action; the dedupe index of 0019 works per recipient.

begin;

-- Writes one notification for the owner and each accepted co-author of the
-- post, except the actor.
create function private.notify_post_team(
  p_post_id uuid,
  p_actor uuid,
  p_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, post_id)
  select t.user_id, p_actor, p_type, p_post_id
  from (
    select p.author_id as user_id
    from public.posts p
    where p.id = p_post_id
    union
    select c.user_id
    from public.post_collaborators c
    where c.post_id = p_post_id
      and c.status = 'accepted'
  ) t
  where t.user_id <> p_actor
  on conflict do nothing;
end;
$$;

revoke all on function private.notify_post_team(uuid, uuid, text)
  from public, anon, authenticated;

-- Likes (replaces the function of 0019; the trigger stays attached).
create or replace function private.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_post_team(new.post_id, new.user_id, 'like');
  return new;
end;
$$;

-- Comments (replaces the function of 0021): a top-level comment goes to the
-- team; a reply still goes to the author of the parent comment only.
create or replace function private.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_author uuid;
begin
  if new.parent_id is null then
    perform private.notify_post_team(new.post_id, new.author_id, 'comment');
  else
    select c.author_id into v_parent_author
    from public.comments c
    where c.id = new.parent_id;

    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (v_parent_author, new.author_id, 'reply', new.post_id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Reposts (replaces the function of 0024).
create or replace function private.notify_on_repost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_post_team(new.post_id, new.user_id, 'repost');
  return new;
end;
$$;

commit;