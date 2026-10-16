-- 0041_suspensions.sql
-- Run after 0040.
-- Moderation round M2a: reversible account suspension (decision D5).
--   A suspended account can still sign in, read and DELETE its own content,
--   but every write listed below is refused by a RESTRICTIVE policy.

begin;

-- 1. moderation_log accepts suspend and unsuspend.
alter table private.moderation_log drop constraint moderation_log_action_valid;
alter table private.moderation_log
  add constraint moderation_log_action_valid
    check (action in ('hide', 'delete', 'restore', 'dismiss', 'suspend', 'unsuspend'));

-- 2. Suspensions (history kept; at most one active row per user).
create table private.suspensions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  note text,
  admin_id uuid not null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid,
  constraint suspensions_reason_valid
    check (reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  constraint suspensions_note_valid
    check (note is null or char_length(note) between 1 and 500)
);

create unique index suspensions_one_active_idx
  on private.suspensions (user_id) where lifted_at is null;

alter table private.suspensions enable row level security;
revoke all on private.suspensions from public, anon, authenticated;

-- 3. Am I suspended? False when auth.uid() is null (SQL Editor stays allowed).
create function private.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.suspensions s
    where s.user_id = (select auth.uid())
      and s.lifted_at is null
  );
$$;

revoke all on function private.is_suspended() from public, anon;
grant execute on function private.is_suspended() to authenticated;

create function public.am_i_suspended()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_suspended();
$$;

revoke all on function public.am_i_suspended() from public, anon;
grant execute on function public.am_i_suspended() to authenticated;

-- 4. RESTRICTIVE policies: no inserts while suspended. Deletes stay allowed.
do $$
declare
  t text;
begin
  foreach t in array array[
    'posts', 'comments', 'likes', 'follows', 'reposts', 'reports',
    'comment_reports', 'repost_caption_reports', 'post_collaborators',
    'post_credits', 'tag_follows'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated '
      'with check (not (select private.is_suspended()))',
      'suspended_no_insert_' || t, t
    );
  end loop;
end;
$$;

-- Updates: posts (edit, publish) and reposts (caption).
create policy suspended_no_update_posts on public.posts
  as restrictive for update to authenticated
  using (not (select private.is_suspended()))
  with check (not (select private.is_suspended()));

create policy suspended_no_update_reposts on public.reposts
  as restrictive for update to authenticated
  using (not (select private.is_suspended()))
  with check (not (select private.is_suspended()));

-- 5. Suspend.
create function private.admin_suspend_user(
  p_user_id uuid,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason), '');
  v_note text := nullif(btrim(p_note), '');
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

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'user_not_found';
  end if;
  -- Covers "yourself" too: only an admin can call this function.
  if exists (select 1 from private.admins a where a.user_id = p_user_id) then
    raise exception 'cannot_suspend_admin' using errcode = '22023';
  end if;
  if exists (
    select 1 from private.suspensions s
    where s.user_id = p_user_id and s.lifted_at is null
  ) then
    raise exception 'already_suspended';
  end if;

  insert into private.suspensions (user_id, reason, note, admin_id)
  values (p_user_id, v_reason, v_note, v_admin);

  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action, reason, note)
  values
    (null, null, p_user_id, v_admin, 'suspend', v_reason, v_note);

  insert into public.moderation_notices (recipient_id, action, reason, note)
  values (p_user_id, 'suspended', v_reason, v_note);
end;
$$;

-- 6. Lift.
create function private.admin_unsuspend_user(
  p_user_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
  where s.user_id = p_user_id and s.lifted_at is null
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
$$;

-- 7. List of active suspensions.
create function private.admin_list_suspended(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  reason text,
  note text,
  suspended_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
  select s.user_id, pr.username, pr.display_name, s.reason, s.note, s.created_at
  from private.suspensions s
  join public.profiles pr on pr.id = s.user_id
  where s.lifted_at is null
  order by s.created_at desc, s.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

-- 8. Author history now also counts suspensions (new return type: drop first).
drop function public.admin_author_history(uuid);
drop function private.admin_author_history(uuid);

create function private.admin_author_history(p_author_id uuid)
returns table (hide_count integer, delete_count integer, suspend_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
  select
    (count(*) filter (where l.action = 'hide'))::integer,
    (count(*) filter (where l.action = 'delete'))::integer,
    (count(*) filter (where l.action = 'suspend'))::integer
  from private.moderation_log l
  where l.post_author_id = p_author_id;
end;
$$;

-- 9. Public wrappers and grants.
create function public.admin_suspend_user(
  p_user_id uuid, p_reason text, p_note text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_suspend_user(p_user_id, p_reason, p_note);
$$;

create function public.admin_unsuspend_user(
  p_user_id uuid, p_note text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_unsuspend_user(p_user_id, p_note);
$$;

create function public.admin_list_suspended(
  p_limit integer default 50, p_offset integer default 0
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  reason text,
  note text,
  suspended_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_suspended(p_limit, p_offset);
$$;

create function public.admin_author_history(p_author_id uuid)
returns table (hide_count integer, delete_count integer, suspend_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_author_history(p_author_id);
$$;

revoke all on function private.admin_suspend_user(uuid, text, text) from public, anon;
grant execute on function private.admin_suspend_user(uuid, text, text) to authenticated;
revoke all on function private.admin_unsuspend_user(uuid, text) from public, anon;
grant execute on function private.admin_unsuspend_user(uuid, text) to authenticated;
revoke all on function private.admin_list_suspended(integer, integer) from public, anon;
grant execute on function private.admin_list_suspended(integer, integer) to authenticated;
revoke all on function private.admin_author_history(uuid) from public, anon;
grant execute on function private.admin_author_history(uuid) to authenticated;

revoke all on function public.admin_suspend_user(uuid, text, text) from public, anon;
grant execute on function public.admin_suspend_user(uuid, text, text) to authenticated;
revoke all on function public.admin_unsuspend_user(uuid, text) from public, anon;
grant execute on function public.admin_unsuspend_user(uuid, text) to authenticated;
revoke all on function public.admin_list_suspended(integer, integer) from public, anon;
grant execute on function public.admin_list_suspended(integer, integer) to authenticated;
revoke all on function public.admin_author_history(uuid) from public, anon;
grant execute on function public.admin_author_history(uuid) to authenticated;

commit;