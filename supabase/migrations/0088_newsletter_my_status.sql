begin;

create or replace function private.my_newsletter_status(p_user uuid, p_author uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case when exists (
    select 1
    from public.newsletter_subscriptions s
    where s.author_id = p_author
      and s.status = 'active'
      and (
        s.user_id = p_user
        or s.email = (
          select lower(u.email) from auth.users u
          where u.id = p_user and u.email_confirmed_at is not null
        )
      )
  ) then 'active' else 'none' end;
$function$;

create or replace function public.my_newsletter_status(p_author uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.my_newsletter_status(auth.uid(), p_author);
$function$;

create or replace function private.unsubscribe_my_newsletter(p_user uuid, p_author uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if p_user is null then
    return 'none';
  end if;
  update public.newsletter_subscriptions s
  set status = 'unsubscribed',
      unsubscribed_at = now()
  where s.author_id = p_author
    and s.status <> 'unsubscribed'
    and (
      s.user_id = p_user
      or s.email = (
        select lower(u.email) from auth.users u
        where u.id = p_user and u.email_confirmed_at is not null
      )
    );
  get diagnostics v_count = row_count;
  return case when v_count > 0 then 'unsubscribed' else 'none' end;
end;
$function$;

create or replace function public.unsubscribe_my_newsletter(p_author uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.unsubscribe_my_newsletter(auth.uid(), p_author);
$function$;

revoke all on function private.my_newsletter_status(uuid, uuid) from public, anon, authenticated;
grant execute on function private.my_newsletter_status(uuid, uuid) to authenticated;
revoke all on function public.my_newsletter_status(uuid) from public, anon, authenticated;
grant execute on function public.my_newsletter_status(uuid) to authenticated;

revoke all on function private.unsubscribe_my_newsletter(uuid, uuid) from public, anon, authenticated;
grant execute on function private.unsubscribe_my_newsletter(uuid, uuid) to authenticated;
revoke all on function public.unsubscribe_my_newsletter(uuid) from public, anon, authenticated;
grant execute on function public.unsubscribe_my_newsletter(uuid) to authenticated;

commit;