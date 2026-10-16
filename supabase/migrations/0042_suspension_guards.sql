-- 0042_suspension_guards.sql
-- Run after 0041.
-- The restrictive policies of 0041 do not apply to security definer
-- functions (save_shared_post, set_shared_post_cover, respond_invite,
-- respond_credit). Triggers fire for every writer, so they close that gap.
-- auth.uid() is still the caller inside those functions; it is NULL in the
-- SQL Editor, where is_suspended() is false (stays allowed).

begin;

create function private.guard_suspended_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_suspended_write()
  from public, anon, authenticated;

-- Posts: only when a content column is written (counters and similar are
-- not touched, so deleting or unliking while suspended keeps working).
create trigger posts_guard_suspended
  before update of title, subtitle, content, excerpt, reading_time_min,
    language, cover_image_url, slug, tags, status, published_at
  on public.posts
  for each row execute function private.guard_suspended_write();

-- Accepting an invitation (collaborator or credit). Declining and leaving
-- are not blocked.
create function private.guard_suspended_accept()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted'
     and old.status is distinct from 'accepted'
     and private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_suspended_accept()
  from public, anon, authenticated;

create trigger post_collaborators_guard_suspended
  before update of status on public.post_collaborators
  for each row execute function private.guard_suspended_accept();

create trigger post_credits_guard_suspended
  before update of status on public.post_credits
  for each row execute function private.guard_suspended_accept();

commit;