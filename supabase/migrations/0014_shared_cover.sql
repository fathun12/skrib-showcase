-- 0014_shared_cover.sql
-- Run after 0013.
-- Co-authoring, step C9a: the cover of a PUBLISHED shared post.
-- Spec: only the holder of the pen may change it (owner or co-author).
-- 1. New function set_shared_post_cover: the ONLY way a co-author writes the
--    cover (a co-author has no UPDATE policy on posts, see 0011).
-- 2. The guard trigger of 0012 now also watches cover_image_url, so the
--    owner's direct update needs the pen too. It only counts while the post
--    is published before AND after the update: Publish (draft -> published,
--    which sets the cover) and Unpublish are not affected.
-- A solo post (no accepted co-author) behaves exactly as before.

begin;

-- ---------------------------------------------------------------------------
-- 1. Guard trigger: add the cover.
-- ---------------------------------------------------------------------------
create or replace function private.guard_shared_post_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  -- SQL Editor / admin.
  if v_user is null then
    return new;
  end if;

  -- Nothing to protect: the text is unchanged, and the cover is unchanged or
  -- the post is not published on both sides (publish and unpublish pass).
  if new.title is not distinct from old.title
     and new.subtitle is not distinct from old.subtitle
     and new.content is not distinct from old.content
     and (
       new.cover_image_url is not distinct from old.cover_image_url
       or old.status <> 'published'
       or new.status <> 'published'
     ) then
    return new;
  end if;

  -- A solo post behaves exactly as before (pending invitees do not count).
  if not exists (
    select 1
    from public.post_collaborators c
    where c.post_id = old.id and c.status = 'accepted'
  ) then
    return new;
  end if;

  -- Shared post: only the holder of the pen may change text or cover.
  if not exists (
    select 1
    from private.post_edit_locks l
    where l.post_id = old.id and l.holder_id = v_user
  ) then
    raise exception 'collab_not_holder';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_shared_post_write()
  from public, anon, authenticated;

drop trigger posts_guard_shared_write on public.posts;

create trigger posts_guard_shared_write
  before update of title, subtitle, content, cover_image_url on public.posts
  for each row execute function private.guard_shared_post_write();

-- ---------------------------------------------------------------------------
-- 2. set_shared_post_cover
-- ---------------------------------------------------------------------------
-- p_cover_url NULL or blank removes the cover. The CHECK constraint
-- posts_cover_url_format (0005) still applies to the value.
create function private.set_shared_post_cover(
  p_post_id uuid,
  p_cover_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_author(p_post_id, v_user) then
    raise exception 'collab_not_allowed';
  end if;

  -- Only the holder of the pen may write. Locking the lock row makes a
  -- hand-over wait until this change has finished (same rule as 0011).
  perform 1
  from private.post_edit_locks l
  where l.post_id = p_post_id and l.holder_id = v_user
  for update;

  if not found then
    raise exception 'collab_not_holder';
  end if;

  -- Only a published post has a stored cover (a draft gets it when the owner
  -- publishes). If the post was unpublished meanwhile, nothing is written.
  update public.posts p
     set cover_image_url = nullif(btrim(coalesce(p_cover_url, '')), '')
   where p.id = p_post_id
     and p.status = 'published';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'collab_status_changed';
  end if;

  -- A cover change is real activity: it keeps the pen alive.
  update private.post_edit_locks l
     set activity_at = now(), heartbeat_at = now()
   where l.post_id = p_post_id;
end;
$$;

create function public.set_shared_post_cover(
  p_post_id uuid,
  p_cover_url text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_shared_post_cover(p_post_id, p_cover_url);
$$;

revoke all on function private.set_shared_post_cover(uuid, text)
  from public, anon;
grant execute on function private.set_shared_post_cover(uuid, text)
  to authenticated;
revoke all on function public.set_shared_post_cover(uuid, text)
  from public, anon;
grant execute on function public.set_shared_post_cover(uuid, text)
  to authenticated;

commit;