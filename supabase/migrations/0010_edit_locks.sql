-- 0010_edit_locks.sql
-- Run after 0009.
-- Co-authoring, step C5 part 1: the edit lock ("the pen"). One row per post
-- that someone is editing. Only the post owner and accepted co-authors can use
-- it. The table lives in the schema "private" (not exposed through the API, no
-- policies, no rights): everything goes through the functions below, and the
-- app calls the thin security invoker wrappers in "public".
--
-- Timings (keep in sync with src/features/collab/constants.ts):
--   pen is free for others after 120 s without a heartbeat
--   an unanswered request moves the pen after 60 s, but only if the holder has
--   not edited for 60 s
--   a refused person must wait 120 s before asking again
-- All times come from the database clock (now()), never from the browser.
-- A holder stays the holder until somebody else actually takes the pen, so a
-- tab that was throttled for a few minutes does not lose its turn by itself.

begin;

-- ---------- fix from 0009 (PROGRESS_COLLAB 6b): check the owner first ----------
-- Before: the post row was locked before anybody checked who was asking, so a
-- stranger could hold the row for a moment. Now a non-owner is refused first.
-- (create or replace keeps the trigger and the privileges of 0009.)
create or replace function private.check_collaborator_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_username text;
  v_count integer;
begin
  select p.author_id into v_owner
  from public.posts p
  where p.id = new.post_id;

  if not found then
    raise exception 'collab_post_not_found';
  end if;

  -- auth.uid() is null in the SQL Editor (admin); a signed-in caller who is
  -- not the owner gets the same answer as for a missing post.
  if auth.uid() is not null and auth.uid() <> v_owner then
    raise exception 'collab_post_not_found';
  end if;

  -- Lock the post row, so two invites sent at the same moment cannot both
  -- pass the cap of 3.
  perform 1 from public.posts p where p.id = new.post_id for update;

  if new.user_id = v_owner then
    raise exception 'collab_self';
  end if;

  select pr.username into v_username
  from public.profiles pr
  where pr.id = new.user_id;

  if v_username is null then
    raise exception 'collab_not_onboarded';
  end if;

  -- Pending and accepted count together (decision D5).
  select count(*) into v_count
  from public.post_collaborators c
  where c.post_id = new.post_id;

  if v_count >= 3 then
    raise exception 'collab_post_limit';
  end if;

  -- Anti-spam: at most 20 pending invitations received per person.
  perform pg_advisory_xact_lock(
    hashtextextended('collab_invitee:' || new.user_id::text, 0)
  );

  select count(*) into v_count
  from public.post_collaborators c
  where c.user_id = new.user_id and c.status = 'pending';

  if v_count >= 20 then
    raise exception 'collab_invitee_limit';
  end if;

  return new;
end;
$$;

-- ---------- the lock table ----------
create table private.post_edit_locks (
  post_id uuid primary key references public.posts (id) on delete cascade,
  holder_id uuid not null references public.profiles (id) on delete cascade,
  acquired_at timestamptz not null default now(),
  -- Any heartbeat of the holder.
  heartbeat_at timestamptz not null default now(),
  -- Only when the holder really edited or saved.
  activity_at timestamptz not null default now(),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz,
  -- Who was refused last ("Not now"), for the 120 s cooldown.
  last_refused_user_id uuid references public.profiles (id) on delete set null,
  last_refused_at timestamptz,
  constraint post_edit_locks_request_matches
    check (requested_by is null or requested_at is not null)
);

alter table private.post_edit_locks enable row level security;
revoke all on private.post_edit_locks from public, anon, authenticated;

-- ---------- helper: owner or accepted co-author ----------
-- Nobody calls this from the API: only the other definer functions.
create function private.is_author(p_post_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and (
    exists (
      select 1 from public.posts p
      where p.id = p_post_id and p.author_id = p_user_id
    )
    or exists (
      select 1 from public.post_collaborators c
      where c.post_id = p_post_id
        and c.user_id = p_user_id
        and c.status = 'accepted'
    )
  );
$$;

revoke all on function private.is_author(uuid, uuid) from public, anon, authenticated;

-- ---------- the state, as one row ----------
-- free:        nobody holds the pen, or the holder is silent for 120 s.
-- is_holder:   the caller holds the pen (also when it is free but not taken).
-- *_seconds:   computed with the server clock, so the browser never compares
--              its own clock with the database.
create function private.lock_state(p_post_id uuid)
returns table (
  holder_id uuid,
  holder_display_name text,
  is_holder boolean,
  free boolean,
  requested_by uuid,
  requested_by_display_name text,
  i_requested boolean,
  request_age_seconds integer,
  holder_idle_seconds integer,
  cooldown_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_author(p_post_id, v_user) then
    raise exception 'collab_not_allowed';
  end if;

  return query
  select
    l.holder_id,
    h.display_name,
    coalesce(l.holder_id = v_user, false),
    (l.post_id is null or l.heartbeat_at < now() - interval '120 seconds'),
    l.requested_by,
    r.display_name,
    coalesce(l.requested_by = v_user, false),
    case when l.requested_at is null then null
         else floor(extract(epoch from (now() - l.requested_at)))::integer end,
    case when l.post_id is null then null
         else floor(extract(epoch from (now() - l.activity_at)))::integer end,
    case when l.last_refused_user_id = v_user
              and l.last_refused_at > now() - interval '120 seconds'
         then ceil(extract(epoch from
                (l.last_refused_at + interval '120 seconds' - now())))::integer
         else 0 end
  from (select 1) as one
  left join private.post_edit_locks l on l.post_id = p_post_id
  left join public.profiles h on h.id = l.holder_id
  left join public.profiles r on r.id = l.requested_by;
end;
$$;

-- ---------- automatic transfer (decision D9) ----------
-- Called at the start of the other functions and by every poll, so a due
-- transfer happens even when the holder's tab is closed.
create function private.apply_due_transfer(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lock private.post_edit_locks%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_author(p_post_id, v_user) then
    raise exception 'collab_not_allowed';
  end if;

  select * into v_lock
  from private.post_edit_locks l
  where l.post_id = p_post_id
  for update;

  if not found or v_lock.requested_by is null then
    return;
  end if;

  if v_lock.requested_at <= now() - interval '60 seconds'
     and v_lock.activity_at <= now() - interval '60 seconds' then
    if private.is_author(p_post_id, v_lock.requested_by) then
      update private.post_edit_locks l
         set holder_id = v_lock.requested_by,
             acquired_at = now(),
             heartbeat_at = now(),
             activity_at = now(),
             requested_by = null,
             requested_at = null,
             last_refused_user_id = null,
             last_refused_at = null
       where l.post_id = p_post_id;
    else
      -- The requester left or was removed meanwhile: drop the request only.
      update private.post_edit_locks l
         set requested_by = null, requested_at = null
       where l.post_id = p_post_id;
    end if;
  end if;
end;
$$;

-- ---------- take the pen ----------
-- Gets it when nobody holds it, when the holder is silent for 120 s, or when
-- the caller already holds it. Otherwise nothing changes: the caller reads the
-- state and sees that somebody else has the pen.
create function private.acquire_edit_lock(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lock private.post_edit_locks%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_author(p_post_id, v_user) then
    raise exception 'collab_not_allowed';
  end if;

  insert into private.post_edit_locks (post_id, holder_id)
  values (p_post_id, v_user)
  on conflict (post_id) do nothing;

  select * into v_lock
  from private.post_edit_locks l
  where l.post_id = p_post_id
  for update;

  if v_lock.holder_id = v_user then
    update private.post_edit_locks l
       set heartbeat_at = now()
     where l.post_id = p_post_id;
  elsif v_lock.heartbeat_at < now() - interval '120 seconds' then
    update private.post_edit_locks l
       set holder_id = v_user,
           acquired_at = now(),
           heartbeat_at = now(),
           activity_at = now(),
           requested_by = null,
           requested_at = null,
           last_refused_user_id = null,
           last_refused_at = null
     where l.post_id = p_post_id;
  end if;
end;
$$;

-- ---------- "I am still here" ----------
-- Only the holder changes anything. p_edited says whether the holder really
-- edited since the last heartbeat (this is what keeps a typist from losing
-- the pen to an automatic transfer).
create function private.heartbeat_edit_lock(p_post_id uuid, p_edited boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_author(p_post_id, v_user) then
    raise exception 'collab_not_allowed';
  end if;

  update private.post_edit_locks l
     set heartbeat_at = now(),
         activity_at = case when coalesce(p_edited, false)
                            then now() else l.activity_at end
   where l.post_id = p_post_id
     and l.holder_id = v_user;

  perform private.apply_due_transfer(p_post_id);
end;
$$;

-- ---------- give the pen back ----------
-- Best effort and harmless: releasing a pen you do not hold does nothing.
create function private.release_edit_lock(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from private.post_edit_locks l
   where l.post_id = p_post_id
     and l.holder_id = v_user;
end;
$$;

-- ---------- ask for a turn ----------
create function private.request_turn(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lock private.post_edit_locks%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_author(p_post_id, v_user) then
    raise exception 'collab_not_allowed';
  end if;

  perform private.apply_due_transfer(p_post_id);

  select * into v_lock
  from private.post_edit_locks l
  where l.post_id = p_post_id
  for update;

  -- Nothing to ask for: the pen is free (the app offers "Start editing").
  if not found or v_lock.heartbeat_at < now() - interval '120 seconds' then
    raise exception 'collab_lock_free';
  end if;

  if v_lock.holder_id = v_user then
    raise exception 'collab_already_holder';
  end if;

  if v_lock.requested_by is not null then
    -- Asking twice is fine; somebody else asking first is not.
    if v_lock.requested_by = v_user then
      return;
    end if;
    raise exception 'collab_request_pending';
  end if;

  if v_lock.last_refused_user_id = v_user
     and v_lock.last_refused_at > now() - interval '120 seconds' then
    raise exception 'collab_request_cooldown';
  end if;

  update private.post_edit_locks l
     set requested_by = v_user, requested_at = now()
   where l.post_id = p_post_id;
end;
$$;

-- ---------- the holder answers ----------
-- Hand over: the request-maker gets the pen with fresh timestamps.
-- Not now: the request is cleared and the person must wait 120 s.
-- The app saves the holder's text BEFORE it calls this with p_hand_over = true.
create function private.respond_turn(p_post_id uuid, p_hand_over boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lock private.post_edit_locks%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select * into v_lock
  from private.post_edit_locks l
  where l.post_id = p_post_id
  for update;

  if not found or v_lock.holder_id <> v_user then
    raise exception 'collab_not_holder';
  end if;
  if v_lock.requested_by is null then
    raise exception 'collab_no_request';
  end if;

  if p_hand_over and private.is_author(p_post_id, v_lock.requested_by) then
    update private.post_edit_locks l
       set holder_id = v_lock.requested_by,
           acquired_at = now(),
           heartbeat_at = now(),
           activity_at = now(),
           requested_by = null,
           requested_at = null,
           last_refused_user_id = null,
           last_refused_at = null
     where l.post_id = p_post_id;
  elsif p_hand_over then
    -- The requester left or was removed meanwhile: just clear the request.
    update private.post_edit_locks l
       set requested_by = null, requested_at = null
     where l.post_id = p_post_id;
  else
    update private.post_edit_locks l
       set last_refused_user_id = v_lock.requested_by,
           last_refused_at = now(),
           requested_by = null,
           requested_at = null
     where l.post_id = p_post_id;
  end if;
end;
$$;

-- ---------- the functions the app calls (security invoker) ----------
create function public.get_lock_state(p_post_id uuid)
returns table (
  holder_id uuid,
  holder_display_name text,
  is_holder boolean,
  free boolean,
  requested_by uuid,
  requested_by_display_name text,
  i_requested boolean,
  request_age_seconds integer,
  holder_idle_seconds integer,
  cooldown_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.apply_due_transfer(p_post_id);
  return query select * from private.lock_state(p_post_id);
end;
$$;

create function public.acquire_edit_lock(p_post_id uuid)
returns table (
  holder_id uuid,
  holder_display_name text,
  is_holder boolean,
  free boolean,
  requested_by uuid,
  requested_by_display_name text,
  i_requested boolean,
  request_age_seconds integer,
  holder_idle_seconds integer,
  cooldown_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.acquire_edit_lock(p_post_id);
  return query select * from private.lock_state(p_post_id);
end;
$$;

create function public.heartbeat_edit_lock(p_post_id uuid, p_edited boolean)
returns table (
  holder_id uuid,
  holder_display_name text,
  is_holder boolean,
  free boolean,
  requested_by uuid,
  requested_by_display_name text,
  i_requested boolean,
  request_age_seconds integer,
  holder_idle_seconds integer,
  cooldown_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.heartbeat_edit_lock(p_post_id, p_edited);
  return query select * from private.lock_state(p_post_id);
end;
$$;

create function public.request_turn(p_post_id uuid)
returns table (
  holder_id uuid,
  holder_display_name text,
  is_holder boolean,
  free boolean,
  requested_by uuid,
  requested_by_display_name text,
  i_requested boolean,
  request_age_seconds integer,
  holder_idle_seconds integer,
  cooldown_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.request_turn(p_post_id);
  return query select * from private.lock_state(p_post_id);
end;
$$;

create function public.respond_turn(p_post_id uuid, p_hand_over boolean)
returns table (
  holder_id uuid,
  holder_display_name text,
  is_holder boolean,
  free boolean,
  requested_by uuid,
  requested_by_display_name text,
  i_requested boolean,
  request_age_seconds integer,
  holder_idle_seconds integer,
  cooldown_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.respond_turn(p_post_id, p_hand_over);
  return query select * from private.lock_state(p_post_id);
end;
$$;

create function public.release_edit_lock(p_post_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.release_edit_lock(p_post_id);
$$;

-- ---------- who may run what ----------
revoke all on function private.lock_state(uuid) from public, anon;
grant execute on function private.lock_state(uuid) to authenticated;
revoke all on function private.apply_due_transfer(uuid) from public, anon;
grant execute on function private.apply_due_transfer(uuid) to authenticated;
revoke all on function private.acquire_edit_lock(uuid) from public, anon;
grant execute on function private.acquire_edit_lock(uuid) to authenticated;
revoke all on function private.heartbeat_edit_lock(uuid, boolean) from public, anon;
grant execute on function private.heartbeat_edit_lock(uuid, boolean) to authenticated;
revoke all on function private.release_edit_lock(uuid) from public, anon;
grant execute on function private.release_edit_lock(uuid) to authenticated;
revoke all on function private.request_turn(uuid) from public, anon;
grant execute on function private.request_turn(uuid) to authenticated;
revoke all on function private.respond_turn(uuid, boolean) from public, anon;
grant execute on function private.respond_turn(uuid, boolean) to authenticated;

revoke all on function public.get_lock_state(uuid) from public, anon;
grant execute on function public.get_lock_state(uuid) to authenticated;
revoke all on function public.acquire_edit_lock(uuid) from public, anon;
grant execute on function public.acquire_edit_lock(uuid) to authenticated;
revoke all on function public.heartbeat_edit_lock(uuid, boolean) from public, anon;
grant execute on function public.heartbeat_edit_lock(uuid, boolean) to authenticated;
revoke all on function public.request_turn(uuid) from public, anon;
grant execute on function public.request_turn(uuid) to authenticated;
revoke all on function public.respond_turn(uuid, boolean) from public, anon;
grant execute on function public.respond_turn(uuid, boolean) to authenticated;
revoke all on function public.release_edit_lock(uuid) from public, anon;
grant execute on function public.release_edit_lock(uuid) to authenticated;

commit;