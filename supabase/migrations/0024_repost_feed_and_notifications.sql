-- 0024_repost_feed_and_notifications.sql
-- Run after 0023.
-- 1) The Following feed with reposts: one row per post.
-- 2) Notification type 'repost' for the author of the reposted story.

begin;

-- One row per post. A post counts when its owner or an accepted co-author is in
-- p_author_ids (like private.published_post_ids) OR someone in p_author_ids
-- reposted it. event_at = the later of the publish time (when an author is in
-- the list) and the newest repost by someone in the list. reposter_id is set
-- only when that repost is the winning event. Keyset order (event_at, post_id).
create function private.following_feed(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (post_id uuid, event_at timestamptz, reposter_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with originals as (
    select p.id as post_id, p.published_at as at
    from public.posts p
    where p.status = 'published'
      and p.published_at is not null
      and (
        p.author_id = any (p_author_ids)
        or exists (
          select 1
          from public.post_collaborators pc
          where pc.post_id = p.id
            and pc.status = 'accepted'
            and pc.user_id = any (p_author_ids)
        )
      )
  ),
  latest_repost as (
    select distinct on (r.post_id) r.post_id, r.created_at as at, r.user_id
    from public.reposts r
    join public.posts p
      on p.id = r.post_id
     and p.status = 'published'
     and p.published_at is not null
    where r.user_id = any (p_author_ids)
    order by r.post_id, r.created_at desc
  ),
  merged as (
    select
      coalesce(o.post_id, lr.post_id) as post_id,
      case when lr.at is not null and (o.at is null or lr.at > o.at)
           then lr.at else o.at end as event_at,
      case when lr.at is not null and (o.at is null or lr.at > o.at)
           then lr.user_id else null end as reposter_id
    from originals o
    full join latest_repost lr on lr.post_id = o.post_id
  )
  select m.post_id, m.event_at, m.reposter_id
  from merged m
  where p_after_at is null
     or (m.event_at, m.post_id) < (p_after_at, p_after_id)
  order by m.event_at desc, m.post_id desc
  limit least(greatest(p_limit, 1), 200);
$$;

create function public.get_following_feed(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (post_id uuid, event_at timestamptz, reposter_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.following_feed(
    p_author_ids, p_after_at, p_after_id, p_limit
  );
$$;

revoke all on function private.following_feed(uuid[], timestamptz, uuid, integer) from public;
revoke all on function public.get_following_feed(uuid[], timestamptz, uuid, integer) from public;
grant execute on function private.following_feed(uuid[], timestamptz, uuid, integer) to authenticated;
grant execute on function public.get_following_feed(uuid[], timestamptz, uuid, integer) to authenticated;

-- Notifications: a fifth type. The dedupe index of 0019 stays: one
-- notification per recipient, actor, type and post (repost, undo, repost
-- again cannot flood the bell).
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications
  add constraint notifications_type_valid
    check (type in ('follow', 'like', 'comment', 'reply', 'repost'));
alter table public.notifications
  add constraint notifications_post_matches_type
    check ((type in ('like', 'comment', 'reply', 'repost')) = (post_id is not null));

create function private.notify_on_repost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  select p.author_id into v_author
  from public.posts p
  where p.id = new.post_id;

  -- Nobody is notified about their own repost.
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (v_author, new.user_id, 'repost', new.post_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_on_repost() from public;

create trigger notify_on_repost
  after insert on public.reposts
  for each row execute function private.notify_on_repost();

commit;