-- 0046: list every Cloudinary URL still in use (avatars, covers, post bodies and
-- old versions of posts), for the admin orphan sweep. Admin only.

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('sweep_images', 10, 3600);

create or replace function private.list_used_image_urls()
 returns table (url text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;

  return query
  with sources as (
    select p.avatar_url as t
      from public.profiles p
    union all
    select po.cover_image_url
      from public.posts po
    union all
    select po.content::text
      from public.posts po
    union all
    select v.content::text
      from private.post_versions v
  )
  select distinct m[1]
    from sources s,
         regexp_matches(s.t, 'https://res\.cloudinary\.com/[^"\s\\]+', 'g') as m
   where s.t is not null;
end;
$function$;

create or replace function public.list_used_image_urls()
 returns table (url text)
 language sql
 security invoker
 set search_path to ''
as $function$
  select * from private.list_used_image_urls();
$function$;

revoke all on function private.list_used_image_urls() from public, anon;
revoke all on function public.list_used_image_urls() from public, anon;
grant execute on function private.list_used_image_urls() to authenticated;
grant execute on function public.list_used_image_urls() to authenticated;