-- 0062: timed suspension (1, 7 or 30 days, or until lifted).
-- The old admin_suspend_user (3 arguments) and the old admin_list_suspended
-- (no expires_at column) are dropped because a changed signature or return
-- type cannot be replaced in place. Only the two wrappers called them.
begin;

alter table private.suspensions
  add column expires_at timestamptz;
alter table private.suspensions
  add constraint suspensions_expiry_valid
  check (expires_at is null or expires_at > created_at);

alter table public.moderation_notices
  add column expires_at timestamptz;
grant select (expires_at) on public.moderation_notices to authenticated;

-- An expired suspension no longer counts. No scheduler is needed.
create or replace function private.is_suspended()
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (
    select 1
    from private.suspensions s
    where s.user_id = (select auth.uid())
      and s.lifted_at is null
      and (s.expires_at is null or s.expires_at > now())
  );
$function$;

-- When does my suspension end? null = not suspended, or until lifted.
create or replace function private.my_suspension_until()
 returns timestamptz
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select s.expires_at
  from private.suspensions s
  where s.user_id = (select auth.uid())
    and s.lifted_at is null
    and (s.expires_at is null or s.expires_at > now())
  order by s.created_at desc
  limit 1;
$function$;

create or replace function public.my_suspension_until()
 returns timestamptz
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select private.my_suspension_until();
$function$;

-- Suspend: p_days is 1, 7 or 30; null means until an admin lifts it.
-- Returns the end time (null = until lifted).
drop function if exists public.admin_suspend_user(uuid, text, text);
drop function if exists private.admin_suspend_user(uuid, text, text);

create or replace function private.admin_suspend_user(
  p_user_id uuid,
  p_reason text,
  p_note text default null,
  p_days integer default null
)
 returns timestamptz
 language plpgsql
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason), '');
  v_note text := nullif(btrim(p_note), '');
  v_expires timestamptz;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if v_reason not in ('spam', 'harassment', 'inappropriate', 'illegal', 'other') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  if p_days is not null and p_days not in (1, 7, 30) then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'user_not_found';
  end if;
  -- Covers "yourself" too: only an admin can call this function.
  if exists (select 1 from private.admins a where a.user_id = p_user_id) then
    raise exception 'cannot_suspend_admin' using errcode = '22023';
  end if;

  -- A suspension that ran out must not block a new one (one active row per user).
  update private.suspensions s
     set lifted_at = s.expires_at
   where s.user_id = p_user_id
     and s.lifted_at is null
     and s.expires_at is not null
     and s.expires_at <= now();

  if exists (
    select 1 from private.suspensions s
    where s.user_id = p_user_id and s.lifted_at is null
  ) then
    raise exception 'already_suspended';
  end if;

  if p_days is not null then
    v_expires := now() + make_interval(days => p_days);
  end if;

  insert into private.suspensions (user_id, reason, note, admin_id, expires_at)
  values (p_user_id, v_reason, v_note, v_admin, v_expires);

  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action, reason, note)
  values
    (null, null, p_user_id, v_admin, 'suspend', v_reason, v_note);

  insert into public.moderation_notices (recipient_id, action, reason, note, expires_at)
  values (p_user_id, 'suspended', v_reason, v_note, v_expires);

  return v_expires;
end;
$function$;

create or replace function public.admin_suspend_user(
  p_user_id uuid,
  p_reason text,
  p_note text default null,
  p_days integer default null
)
 returns timestamptz
 language sql
 security invoker
 set search_path to ''
as $function$
  select private.admin_suspend_user(p_user_id, p_reason, p_note, p_days);
$function$;

-- Lift: an expired row is not "suspended" any more (same signature as before).
create or replace function private.admin_unsuspend_user(p_user_id uuid, p_note text default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_note text := nullif(btrim(p_note), '');
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;

  select s.id into v_id
  from private.suspensions s
  where s.user_id = p_user_id
    and s.lifted_at is null
    and (s.expires_at is null or s.expires_at > now())
  for update;

  if not found then
    raise exception 'not_suspended';
  end if;

  update private.suspensions
     set lifted_at = now(), lifted_by = v_admin
   where id = v_id;

  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action, note)
  values
    (null, null, p_user_id, v_admin, 'unsuspend', v_note);

  insert into public.moderation_notices (recipient_id, action, note)
  values (p_user_id, 'unsuspended', v_note);
end;
$function$;

-- The Suspended list: active suspensions only, with the end time.
drop function if exists public.admin_list_suspended(integer, integer);
drop function if exists private.admin_list_suspended(integer, integer);

create or replace function private.admin_list_suspended(
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   user_id uuid,
   username text,
   display_name text,
   reason text,
   note text,
   suspended_at timestamptz,
   expires_at timestamptz
 )
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
  select s.user_id, pr.username, pr.display_name, s.reason, s.note,
         s.created_at, s.expires_at
  from private.suspensions s
  join public.profiles pr on pr.id = s.user_id
  where s.lifted_at is null
    and (s.expires_at is null or s.expires_at > now())
  order by s.created_at desc, s.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$function$;

create or replace function public.admin_list_suspended(
  p_limit integer default 50,
  p_offset integer default 0
)
 returns table (
   user_id uuid,
   username text,
   display_name text,
   reason text,
   note text,
   suspended_at timestamptz,
   expires_at timestamptz
 )
 language sql
 stable
 security invoker
 set search_path to ''
as $function$
  select * from private.admin_list_suspended(p_limit, p_offset);
$function$;

revoke all on function private.my_suspension_until() from public, anon;
revoke all on function public.my_suspension_until() from public, anon;
revoke all on function private.admin_suspend_user(uuid, text, text, integer) from public, anon;
revoke all on function public.admin_suspend_user(uuid, text, text, integer) from public, anon;
revoke all on function private.admin_list_suspended(integer, integer) from public, anon;
revoke all on function public.admin_list_suspended(integer, integer) from public, anon;
grant execute on function private.my_suspension_until() to authenticated;
grant execute on function public.my_suspension_until() to authenticated;
grant execute on function private.admin_suspend_user(uuid, text, text, integer) to authenticated;
grant execute on function public.admin_suspend_user(uuid, text, text, integer) to authenticated;
grant execute on function private.admin_list_suspended(integer, integer) to authenticated;
grant execute on function public.admin_list_suspended(integer, integer) to authenticated;

commit;