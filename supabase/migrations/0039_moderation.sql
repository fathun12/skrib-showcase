-- 0039_moderation.sql
-- Run after 0038.
-- In-app moderation (no more manual SQL):
--   1. posts.status gets a third value, 'hidden' (hidden by moderation).
--      Every public query already filters status = 'published', so a hidden
--      post disappears from the feed, search, sitemap, likes, comments and
--      reports by itself.
--   2. private.admins + private.is_admin(): who may moderate. Not readable
--      through the API (profiles are public, so a column there would leak it).
--   3. A guard trigger: only an admin can move a post INTO or OUT OF 'hidden'.
--      The author keeps the normal update right on the post (edits, delete)
--      but can never publish it again on their own.
--   4. private.moderation_log: a record of every moderation action. It has no
--      foreign key on purpose: the reports of a deleted post disappear (cascade),
--      the log must not.
--   5. Admin functions (security definer, schema private, thin wrappers in
--      public): list reports grouped by post, list hidden posts, read a post
--      that is hidden, and moderate (hide, delete, restore, dismiss).
-- The first admin is added by hand AFTER this migration (see the chat), so
-- this file is the same for everyone.

begin;

-- ---------------------------------------------------------------------------
-- 1. The 'hidden' status.
-- The original check was written inline in 0001 and so has an automatic name.
-- Instead of trusting the name, find the check that lists 'draft' and
-- 'published' and drop it. It must find exactly one, otherwise the whole
-- migration stops (and rolls back).
-- ---------------------------------------------------------------------------
do $$
declare
  v_name text;
  v_count integer := 0;
begin
  for v_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.posts'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%''draft''%'
      and pg_get_constraintdef(c.oid) like '%''published''%'
  loop
    execute format('alter table public.posts drop constraint %I', v_name);
    v_count := v_count + 1;
  end loop;

  if v_count <> 1 then
    raise exception 'expected exactly one status check on public.posts, found %', v_count;
  end if;
end;
$$;

alter table public.posts
  add constraint posts_status_valid
    check (status in ('draft', 'published', 'hidden'));

-- ---------------------------------------------------------------------------
-- 2. Admins.
-- ---------------------------------------------------------------------------
create table private.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No API access at all (same as the rate limit tables of 0007).
alter table private.admins enable row level security;
revoke all on private.admins from public, anon, authenticated;

-- Is the signed-in user an admin? No argument on purpose: nobody can ask
-- about somebody else.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- The app uses this to show the Moderation link in the menu (admins only).
create function public.am_i_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Guard trigger: only an admin moves a post into or out of 'hidden'.
-- security definer so it can read private.admins. auth.uid() is NULL in the
-- SQL Editor, which stays allowed (same rule as the trigger of 0012).
-- ---------------------------------------------------------------------------
create function private.guard_post_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_changes boolean;
begin
  -- SQL Editor.
  if v_user is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_changes := new.status = 'hidden';
  else
    v_changes := (old.status = 'hidden') is distinct from (new.status = 'hidden');
  end if;

  if v_changes and not exists (
    select 1 from private.admins a where a.user_id = v_user
  ) then
    raise exception 'moderation_locked' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_post_moderation()
  from public, anon, authenticated;

create trigger posts_guard_moderation
  before insert or update of status on public.posts
  for each row execute function private.guard_post_moderation();

-- ---------------------------------------------------------------------------
-- 4. Moderation log.
-- ---------------------------------------------------------------------------
create table private.moderation_log (
  id uuid primary key default gen_random_uuid(),
  -- No foreign keys on purpose: the log outlives the post and the profile.
  post_id uuid not null,
  post_title text not null,
  post_author_id uuid not null,
  admin_id uuid not null,
  action text not null,
  -- The open reports that were decided with this action.
  report_count integer not null default 0,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint moderation_log_action_valid
    check (action in ('hide', 'delete', 'restore', 'dismiss'))
);

create index moderation_log_post_idx
  on private.moderation_log (post_id, created_at desc);

alter table private.moderation_log enable row level security;
revoke all on private.moderation_log from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5a. Open (or resolved, or dismissed) reports, grouped by post.
-- ---------------------------------------------------------------------------
create function private.admin_list_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  post_id uuid,
  post_title text,
  post_slug text,
  post_status text,
  author_id uuid,
  author_username text,
  author_display_name text,
  report_count integer,
  reasons text[],
  latest_report_at timestamptz,
  reports jsonb
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
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  return query
  select
    p.id,
    p.title,
    p.slug,
    p.status,
    p.author_id,
    pr.username,
    pr.display_name,
    count(*)::integer,
    array_agg(distinct r.reason order by r.reason),
    max(r.created_at),
    jsonb_agg(
      jsonb_build_object(
        'reason', r.reason,
        'details', r.details,
        'created_at', r.created_at
      )
      order by r.created_at desc
    )
  from public.reports r
  join public.posts p on p.id = r.post_id
  join public.profiles pr on pr.id = p.author_id
  where r.status = p_status
  group by p.id, pr.username, pr.display_name
  order by max(r.created_at) desc, p.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5b. Posts that are hidden right now (for Restore).
-- ---------------------------------------------------------------------------
create function private.admin_list_hidden_posts(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  post_id uuid,
  post_title text,
  post_slug text,
  author_id uuid,
  author_username text,
  author_display_name text,
  hidden_at timestamptz
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
  select
    p.id,
    p.title,
    p.slug,
    p.author_id,
    pr.username,
    pr.display_name,
    (
      select max(l.created_at)
      from private.moderation_log l
      where l.post_id = p.id and l.action = 'hide'
    )
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.status = 'hidden'
  order by 7 desc nulls last, p.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5c. Read one post whatever its status. A hidden post is invisible on its
-- public page (RLS), so the admin needs this to read it before restoring.
-- ---------------------------------------------------------------------------
create function private.admin_get_post(p_post_id uuid)
returns table (
  post_id uuid,
  title text,
  subtitle text,
  content jsonb,
  status text,
  language text,
  published_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text
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
  select
    p.id,
    p.title,
    p.subtitle,
    p.content,
    p.status,
    p.language,
    p.published_at,
    p.author_id,
    pr.username,
    pr.display_name
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.id = p_post_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5d. The decision itself.
--   hide    published -> hidden; the open reports of the post become resolved
--   delete  the post is deleted (reports, comments, likes go with it)
--   restore hidden -> published (the author's published_at is kept)
--   dismiss the open reports become dismissed; the post is untouched
-- Every action is written to private.moderation_log first, in the same
-- transaction, so the record survives a delete.
-- ---------------------------------------------------------------------------
create function private.admin_moderate_post(p_post_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_admin uuid := auth.uid();
  v_title text;
  v_status text;
  v_author uuid;
  v_count integer;
  v_reasons text[];
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'delete', 'restore', 'dismiss') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  -- Lock the post so two decisions cannot cross each other.
  select p.title, p.status, p.author_id
    into v_title, v_status, v_author
  from public.posts p
  where p.id = p_post_id
  for update;

  if not found then
    raise exception 'post_not_found';
  end if;

  if p_action = 'hide' and v_status <> 'published' then
    raise exception 'moderation_not_published';
  end if;
  if p_action = 'restore' and v_status <> 'hidden' then
    raise exception 'moderation_not_hidden';
  end if;

  select count(*)::integer,
         coalesce(array_agg(distinct r.reason order by r.reason), array[]::text[])
    into v_count, v_reasons
  from public.reports r
  where r.post_id = p_post_id and r.status = 'open';

  insert into private.moderation_log
    (post_id, post_title, post_author_id, admin_id, action, report_count, reasons)
  values
    (p_post_id, v_title, v_author, v_admin, p_action, v_count, v_reasons);

  if p_action = 'hide' then
    update public.posts set status = 'hidden' where id = p_post_id;
    update public.reports set status = 'resolved'
     where post_id = p_post_id and status = 'open';

  elsif p_action = 'restore' then
    update public.posts set status = 'published' where id = p_post_id;

  elsif p_action = 'dismiss' then
    update public.reports set status = 'dismissed'
     where post_id = p_post_id and status = 'open';

  else
    delete from public.posts where id = p_post_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public wrappers (security invoker, like the rest of the app) and grants.
-- ---------------------------------------------------------------------------
create function public.admin_list_reports(
  p_status text default 'open',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  post_id uuid,
  post_title text,
  post_slug text,
  post_status text,
  author_id uuid,
  author_username text,
  author_display_name text,
  report_count integer,
  reasons text[],
  latest_report_at timestamptz,
  reports jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_reports(p_status, p_limit, p_offset);
$$;

create function public.admin_list_hidden_posts(
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  post_id uuid,
  post_title text,
  post_slug text,
  author_id uuid,
  author_username text,
  author_display_name text,
  hidden_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_hidden_posts(p_limit, p_offset);
$$;

create function public.admin_get_post(p_post_id uuid)
returns table (
  post_id uuid,
  title text,
  subtitle text,
  content jsonb,
  status text,
  language text,
  published_at timestamptz,
  author_id uuid,
  author_username text,
  author_display_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_get_post(p_post_id);
$$;

create function public.admin_moderate_post(p_post_id uuid, p_action text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_moderate_post(p_post_id, p_action);
$$;

revoke all on function private.admin_list_reports(text, integer, integer) from public, anon;
grant execute on function private.admin_list_reports(text, integer, integer) to authenticated;
revoke all on function private.admin_list_hidden_posts(integer, integer) from public, anon;
grant execute on function private.admin_list_hidden_posts(integer, integer) to authenticated;
revoke all on function private.admin_get_post(uuid) from public, anon;
grant execute on function private.admin_get_post(uuid) to authenticated;
revoke all on function private.admin_moderate_post(uuid, text) from public, anon;
grant execute on function private.admin_moderate_post(uuid, text) to authenticated;

revoke all on function public.admin_list_reports(text, integer, integer) from public, anon;
grant execute on function public.admin_list_reports(text, integer, integer) to authenticated;
revoke all on function public.admin_list_hidden_posts(integer, integer) from public, anon;
grant execute on function public.admin_list_hidden_posts(integer, integer) to authenticated;
revoke all on function public.admin_get_post(uuid) from public, anon;
grant execute on function public.admin_get_post(uuid) to authenticated;
revoke all on function public.admin_moderate_post(uuid, text) from public, anon;
grant execute on function public.admin_moderate_post(uuid, text) to authenticated;

commit;