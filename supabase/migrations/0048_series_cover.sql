-- 0048: cover image for a series.
-- The two image-listing functions MUST include series covers in this same
-- migration: otherwise the admin sweep deletes every series cover after 24 h,
-- and account deletion leaves them behind.

alter table public.series
  add column cover_image_url text;

alter table public.series
  add constraint series_cover_url_valid
  check (
    cover_image_url is null
    or (
      char_length(cover_image_url) <= 500
      and cover_image_url like 'https://res.cloudinary.com/%'
    )
  );

-- Harmless if table-level rights already exist; needed if they are per column.
grant select (cover_image_url) on public.series to anon, authenticated;
grant insert (cover_image_url), update (cover_image_url)
  on public.series to authenticated;

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
    union all
    select s.cover_image_url
      from public.series s
     where s.author_id = v_user
  )
  select distinct m[1]
    from sources s,
         regexp_matches(s.t, 'https://res\.cloudinary\.com/[^"\s\\]+', 'g') as m
   where s.t is not null;
end;
$function$;

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
    union all
    select s.cover_image_url
      from public.series s
  )
  select distinct m[1]
    from sources s,
         regexp_matches(s.t, 'https://res\.cloudinary\.com/[^"\s\\]+', 'g') as m
   where s.t is not null;
end;
$function$;