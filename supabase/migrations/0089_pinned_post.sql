begin;

alter table public.profiles
  add column pinned_post_id uuid references public.posts(id) on delete set null;

create index profiles_pinned_post_idx
  on public.profiles (pinned_post_id)
  where pinned_post_id is not null;

grant select (pinned_post_id) on public.profiles to anon, authenticated;

create or replace function private.set_pinned_post(p_user uuid, p_post uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  if p_post is null then
    update public.profiles set pinned_post_id = null where id = p_user;
    return 'unpinned';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post
      and p.author_id = p_user
      and p.status = 'published'
      and p.published_at is not null
  ) then
    return 'not_allowed';
  end if;

  update public.profiles set pinned_post_id = p_post where id = p_user;
  return 'pinned';
end;
$function$;

create or replace function public.set_pinned_post(p_post uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.set_pinned_post(auth.uid(), p_post);
$function$;

revoke all on function private.set_pinned_post(uuid, uuid) from public, anon, authenticated;
grant execute on function private.set_pinned_post(uuid, uuid) to authenticated;
revoke all on function public.set_pinned_post(uuid) from public, anon, authenticated;
grant execute on function public.set_pinned_post(uuid) to authenticated;

commit;