-- 0066: lets a signed-in user ask "did this author block me?" without reading note_blocks.
create function private.i_am_blocked_by(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.note_blocks b
     where b.blocker_id = p_author
       and b.blocked_id = (select auth.uid())
  );
$$;
revoke execute on function private.i_am_blocked_by(uuid) from public, anon;
grant execute on function private.i_am_blocked_by(uuid) to authenticated;

create function public.i_am_blocked_by(p_author uuid)
returns boolean
language sql
stable
security invoker
set search_path to ''
as $$
  select private.i_am_blocked_by(p_author);
$$;
revoke execute on function public.i_am_blocked_by(uuid) from public, anon;
grant execute on function public.i_am_blocked_by(uuid) to authenticated;