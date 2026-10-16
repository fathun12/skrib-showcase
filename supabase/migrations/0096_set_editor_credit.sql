-- 0096_set_editor_credit.sql
-- The owner switches "Edited by" on or off for an editor after the invitation
-- was accepted. post_collaborators has no UPDATE grant on purpose, so this goes
-- through a security definer function (same pattern as respond_invite).

create or replace function private.set_editor_credit(
  p_post_id uuid,
  p_user_id uuid,
  p_show_credit boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  if not private.is_post_owner(p_post_id) then
    raise exception 'collab_not_allowed';
  end if;

  update public.post_collaborators c
     set show_credit = p_show_credit
   where c.post_id = p_post_id
     and c.user_id = p_user_id
     and c.role = 'editor';

  if not found then
    raise exception 'collab_editor_not_found';
  end if;
end;
$$;

revoke all on function private.set_editor_credit(uuid, uuid, boolean) from public, anon;
grant execute on function private.set_editor_credit(uuid, uuid, boolean) to authenticated;

create or replace function public.set_editor_credit(
  p_post_id uuid,
  p_user_id uuid,
  p_show_credit boolean
)
returns void
language sql
set search_path = ''
as $$
  select private.set_editor_credit(p_post_id, p_user_id, p_show_credit);
$$;

revoke all on function public.set_editor_credit(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_editor_credit(uuid, uuid, boolean) to authenticated;