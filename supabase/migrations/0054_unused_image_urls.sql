-- 0054: which of the given image URLs are not used by anything any more.
-- Used right after a post is deleted, so its cover and body images are only
-- removed from Cloudinary when no other profile, post, old version or series
-- still uses them (for example an image pasted into two posts).
-- Read-only. The check must see other people's rows too, so it is a security
-- definer function in "private", with a security invoker wrapper in "public".

begin;

create function private.unused_image_urls(p_urls text[])
returns table (url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if coalesce(array_length(p_urls, 1), 0) > 200 then
    raise exception 'too_many_urls';
  end if;

  return query
  select c.u
  from (select distinct unnest(p_urls) as u) c
  where c.u like 'https://res.cloudinary.com/%'
    and not exists (
      select 1 from public.profiles p where p.avatar_url = c.u)
    and not exists (
      select 1 from public.posts po where po.cover_image_url = c.u)
    and not exists (
      select 1 from public.series s where s.cover_image_url = c.u)
    and not exists (
      select 1 from public.posts po
      where strpos(po.content::text, c.u) > 0)
    and not exists (
      select 1 from private.post_versions v
      where strpos(v.content::text, c.u) > 0);
end;
$$;

create function public.unused_image_urls(p_urls text[])
returns table (url text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.unused_image_urls(p_urls);
$$;

revoke all on function private.unused_image_urls(text[]) from public, anon;
grant execute on function private.unused_image_urls(text[]) to authenticated;
revoke all on function public.unused_image_urls(text[]) from public, anon;
grant execute on function public.unused_image_urls(text[]) to authenticated;

commit;