-- 0011_save_shared_post.sql
-- Run after 0010.
-- Co-authoring, step C5 part 2: the ONLY way a co-author writes to a post.
-- A co-author has no UPDATE policy on posts (RLS cannot limit columns, so a
-- policy would let them change status, slug or author_id). This function
-- changes exactly five columns, and only for the person who holds the pen.
-- The owner will use it too for posts that have co-authors (step C7).
--
-- The safety-net trigger of COLLAB_SPEC section 6 is NOT in this file on
-- purpose: it moves to step C7, together with the app change that sends every
-- save of a shared post through this function. Added earlier, it would reject
-- the owner's normal autosave on such a post.

begin;

-- p_expected_status is what the editor believes the post is ('draft' for
-- autosave, 'published' for the Update button). If the post changed state in
-- the meantime (for example the owner published it), nothing is written: a
-- stale draft-mode tab must never push half-finished text into a live post.
-- Excerpt and reading time are computed by the app, exactly as for the owner.
create function private.save_shared_post(
  p_post_id uuid,
  p_title text,
  p_subtitle text,
  p_content jsonb,
  p_excerpt text,
  p_reading_time_min integer,
  p_expected_status text
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

  if p_title is null
     or p_content is null
     or jsonb_typeof(p_content) <> 'object'
     or p_expected_status is null
     or p_expected_status not in ('draft', 'published') then
    raise exception 'collab_bad_input';
  end if;

  -- Only the holder of the pen may write. Locking the lock row also makes a
  -- hand-over wait until this save has finished, so the last text is never
  -- lost. (A holder whose heartbeat is late is still the holder until
  -- somebody else takes the pen, same rule as in 0010.)
  perform 1
  from private.post_edit_locks l
  where l.post_id = p_post_id and l.holder_id = v_user
  for update;

  if not found then
    raise exception 'collab_not_holder';
  end if;

  -- The CHECK constraints of 0005 still apply (title length, content size,
  -- published needs a title).
  update public.posts p
     set title = p_title,
         subtitle = nullif(btrim(coalesce(p_subtitle, '')), ''),
         content = p_content,
         excerpt = p_excerpt,
         reading_time_min = p_reading_time_min
   where p.id = p_post_id
     and p.status = p_expected_status;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'collab_status_changed';
  end if;

  -- A save is real activity: it protects the holder from the automatic
  -- transfer and keeps the pen alive.
  update private.post_edit_locks l
     set activity_at = now(), heartbeat_at = now()
   where l.post_id = p_post_id;
end;
$$;

create function public.save_shared_post(
  p_post_id uuid,
  p_title text,
  p_subtitle text,
  p_content jsonb,
  p_excerpt text,
  p_reading_time_min integer,
  p_expected_status text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_shared_post(
    p_post_id, p_title, p_subtitle, p_content,
    p_excerpt, p_reading_time_min, p_expected_status
  );
$$;

revoke all on function private.save_shared_post(uuid, text, text, jsonb, text, integer, text)
  from public, anon;
grant execute on function private.save_shared_post(uuid, text, text, jsonb, text, integer, text)
  to authenticated;
revoke all on function public.save_shared_post(uuid, text, text, jsonb, text, integer, text)
  from public, anon;
grant execute on function public.save_shared_post(uuid, text, text, jsonb, text, integer, text)
  to authenticated;

commit;