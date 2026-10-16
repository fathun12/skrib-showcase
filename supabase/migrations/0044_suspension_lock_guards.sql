-- 0044: suspended accounts cannot take, keep or request the edit pen.

create or replace function private.acquire_edit_lock(p_post_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_lock private.post_edit_locks%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
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
$function$;

create or replace function private.heartbeat_edit_lock(p_post_id uuid, p_edited boolean)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
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
$function$;

create or replace function private.request_turn(p_post_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_lock private.post_edit_locks%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
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
$function$;