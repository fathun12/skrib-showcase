-- 0012_shared_write_guard.sql
-- Run after 0011.
-- Co-authoring, step C7a: the safety-net trigger of COLLAB_SPEC section 6.
-- A post with at least one ACCEPTED co-author may only get new text
-- (title, subtitle, content) from the person who holds the pen. This also
-- stops a direct write through the API with the publishable key.
-- Not affected: posts without accepted co-authors, the SQL Editor / admin
-- (no JWT, auth.uid() is null), updates that change none of the three
-- columns, and every other column (status, slug, cover, ...), so Publish,
-- Unpublish and Cover keep working for the owner.
-- save_shared_post (0011) passes this trigger because it has already
-- checked that the caller holds the pen.

begin;

create function private.guard_shared_post_write()
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

  -- Nothing changed in the guarded columns: nothing to protect.
  if new.title is not distinct from old.title
     and new.subtitle is not distinct from old.subtitle
     and new.content is not distinct from old.content then
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

  -- Shared post: only the holder of the pen may change the text.
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

create trigger posts_guard_shared_write
  before update of title, subtitle, content on public.posts
  for each row execute function private.guard_shared_post_write();

commit;