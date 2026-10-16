-- 0045: self-service account deletion.
-- list_my_image_urls: every Cloudinary URL the user owns (avatar, covers, post
-- bodies, and old versions of their posts), so the app can delete the images.
-- delete_my_account: deletes auth.users of auth.uid(); every table cascades from it.

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('delete_account', 5, 3600);

create or replace function private.list_my_image_urls()
 returns table (url text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  return query
  with sources as (
    select p.avatar_url as t
      from public.profiles p
     where p.id = v_user
    union all
    select po.cover_image_url
      from public.posts po
     where po.author_id = v_user
    union all
    select po.content::text
      from public.posts po
     where po.author_id = v_user
    union all
    select v.content::text
      from private.post_versions v
      join public.posts po on po.id = v.post_id
     where po.author_id = v_user
  )
  select distinct m[1]
    from sources s,
         regexp_matches(s.t, 'https://res\.cloudinary\.com/[^"\s\\]+', 'g') as m
   where s.t is not null;
end;
$function$;

create or replace function private.delete_my_account()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  -- The last admin must not disappear: remove the admin row by hand first.
  if private.is_admin() then
    raise exception 'account_is_admin';
  end if;
  -- A post with accepted co-authors is shared work: the owner removes the
  -- co-authors first.
  if exists (
    select 1
      from public.post_collaborators c
      join public.posts p on p.id = c.post_id
     where p.author_id = v_user
       and c.status = 'accepted'
  ) then
    raise exception 'account_has_coauthors';
  end if;

  delete from auth.users where id = v_user;
end;
$function$;

create or replace function public.list_my_image_urls()
 returns table (url text)
 language sql
 security invoker
 set search_path to ''
as $function$
  select * from private.list_my_image_urls();
$function$;

create or replace function public.delete_my_account()
 returns void
 language sql
 security invoker
 set search_path to ''
as $function$
  select private.delete_my_account();
$function$;

revoke all on function private.list_my_image_urls() from public, anon;
revoke all on function private.delete_my_account() from public, anon;
revoke all on function public.list_my_image_urls() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function private.list_my_image_urls() to authenticated;
grant execute on function private.delete_my_account() to authenticated;
grant execute on function public.list_my_image_urls() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
