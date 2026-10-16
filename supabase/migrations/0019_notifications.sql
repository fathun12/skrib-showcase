-- 0019_notifications.sql
-- Run after 0018.
-- Notifications (ecosystem stage B). Follow and like events are stored by
-- triggers; "new post from someone I follow" is computed on read.

begin;

-- When the user last opened the notifications page. No row = never.
create table public.notification_state (
  user_id uuid primary key default auth.uid()
    references public.profiles (id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.notification_state enable row level security;
revoke all on public.notification_state from anon, authenticated;
grant select on public.notification_state to authenticated;
grant insert (seen_at) on public.notification_state to authenticated;
grant update (seen_at) on public.notification_state to authenticated;

create policy "notification_state_select_own"
  on public.notification_state for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_state_insert_own"
  on public.notification_state for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "notification_state_update_own"
  on public.notification_state for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Follow and like events. Written only by the triggers below.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  post_id uuid references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint notifications_type_valid check (type in ('follow', 'like')),
  constraint notifications_post_matches_type
    check ((type = 'like') = (post_id is not null))
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_post_idx on public.notifications (post_id)
  where post_id is not null;

-- One notification per person, kind and post: like, unlike, like again
-- cannot flood the bell.
create unique index notifications_dedupe_idx
  on public.notifications (
    recipient_id, actor_id, type,
    coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

-- No insert, update or delete policy on purpose: only the triggers write.
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

-- Trigger functions live in the schema private (never exposed through the API).
create function private.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow')
  on conflict do nothing;
  return new;
end;
$$;

create function private.notify_on_like()
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

  -- Nobody is notified about their own like.
  if v_author is not null and v_author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (v_author, new.user_id, 'like', new.post_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_on_follow() from public;
revoke all on function private.notify_on_like() from public;

create trigger notify_on_follow
  after insert on public.follows
  for each row execute function private.notify_on_follow();

create trigger notify_on_like
  after insert on public.likes
  for each row execute function private.notify_on_like();

-- Published posts of people I follow, published after I started following
-- them and after p_since. security invoker: RLS still applies.
create function public.get_my_new_posts(p_since timestamptz, p_limit int)
returns table (post_id uuid, published_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id, p.published_at
  from public.posts p
  join public.follows f
    on f.following_id = p.author_id
   and f.follower_id = auth.uid()
  where p.status = 'published'
    and p.published_at > greatest(p_since, f.created_at)
  order by p.published_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.get_my_new_posts(timestamptz, int) from public;
grant execute on function public.get_my_new_posts(timestamptz, int) to authenticated;

-- Rate limit rule (migration 0007): marking as seen, 120 an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('notifications_seen', 120, 3600)
on conflict (action) do nothing;

commit;