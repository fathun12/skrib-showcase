-- When a collaborator row disappears (leave, remove, decline, account
-- deletion), free the pen that person holds and clear their pending request.
create function private.release_lock_of_removed_collaborator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.post_edit_locks l
   where l.post_id = old.post_id
     and l.holder_id = old.user_id;

  update private.post_edit_locks l
     set requested_by = null, requested_at = null
   where l.post_id = old.post_id
     and l.requested_by = old.user_id;

  return old;
end;
$$;

revoke all on function private.release_lock_of_removed_collaborator()
  from public, anon, authenticated;

create trigger post_collaborators_release_lock
  after delete on public.post_collaborators
  for each row execute function private.release_lock_of_removed_collaborator();