-- 0006_tighten_grants.sql
-- Run after 0005.
-- This project hands out full table rights to anon and authenticated by
-- default, and 0003 only ADDED grants. Take everything away, then give back
-- exactly what 0003 meant. RLS still decides which rows; this decides which
-- operations are possible at all.

begin;

revoke all on public.profiles, public.posts, public.follows, public.likes
  from anon, authenticated;

grant select on public.profiles, public.posts, public.follows, public.likes
  to anon, authenticated;

-- Column-level: users can edit only these profile columns (never id/created_at).
grant update (username, display_name, bio, avatar_url)
  on public.profiles to authenticated;

grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.follows to authenticated;
grant insert, delete on public.likes to authenticated;

commit;