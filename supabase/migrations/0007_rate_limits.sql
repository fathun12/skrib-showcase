-- 0007_rate_limits.sql
-- Run after 0006.
-- Per-user rate limiting with a fixed window counter. The tables and the
-- SECURITY DEFINER function live in the schema "private", which is not exposed
-- through the API; the app calls the thin wrapper public.check_rate_limit().

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- The limits. Edit them in the Table Editor (schema "private"), no code needed.
create table private.rate_limit_rules (
  action text primary key,
  max_hits integer not null check (max_hits between 1 and 10000),
  window_seconds integer not null check (window_seconds between 10 and 3600)
);

insert into private.rate_limit_rules (action, max_hits, window_seconds) values
  ('save_post',      60,   60),   -- savePost, updatePublishedPost (autosave is about 30 a minute)
  ('upload',         20,  600),   -- signUpload
  ('follow',         60,   60),   -- setFollow
  ('like',           60,   60),   -- setLike
  ('post_admin',     30,   60),   -- publish, unpublish, delete, change cover
  ('profile_update', 10,  600),   -- updateProfile
  ('onboarding',     10, 3600);   -- completeOnboarding

-- One row per user, action and time window.
create table private.rate_limits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, action, window_start)
);

-- No API access at all: RLS on with no policies, and no table rights.
alter table private.rate_limit_rules enable row level security;
alter table private.rate_limits enable row level security;
revoke all on private.rate_limit_rules, private.rate_limits
  from public, anon, authenticated;

-- The real work. Counts this call and says whether it is allowed.
create or replace function private.check_rate_limit(p_action text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_max integer;
  v_window integer;
  v_start timestamptz;
  v_hits integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select r.max_hits, r.window_seconds
    into v_max, v_window
  from private.rate_limit_rules r
  where r.action = p_action;

  if not found then
    raise exception 'unknown rate limit action' using errcode = '22023';
  end if;

  -- Start of the current window, from the database clock (never the browser's).
  v_start := to_timestamp(
    (floor(extract(epoch from now()) / v_window) * v_window)::double precision
  );

  insert into private.rate_limits as l (user_id, action, window_start, hits)
  values (v_user, p_action, v_start, 1)
  on conflict (user_id, action, window_start)
  do update set hits = l.hits + 1
  returning l.hits into v_hits;

  -- First hit of a new window: remove this user's old rows (keeps the table tiny).
  if v_hits = 1 then
    delete from private.rate_limits d
    where d.user_id = v_user
      and d.window_start < now() - interval '2 hours';
  end if;

  allowed := v_hits <= v_max;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (v_start + make_interval(secs => v_window) - now())))::integer
    )
  end;
  return next;
end;
$$;

-- The function the app calls (security invoker, like get_like_counts).
create or replace function public.check_rate_limit(p_action text)
returns table (allowed boolean, retry_after_seconds integer)
language sql
security invoker
set search_path = ''
as $$
  select c.allowed, c.retry_after_seconds
  from private.check_rate_limit(p_action) c;
$$;

revoke all on function private.check_rate_limit(text) from public, anon;
grant execute on function private.check_rate_limit(text) to authenticated;
revoke all on function public.check_rate_limit(text) from public, anon;
grant execute on function public.check_rate_limit(text) to authenticated;

commit;