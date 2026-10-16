-- 0004_like_counts.sql
-- Like counts for many posts in one query (used by the post cards).
-- Posts without likes are simply absent from the result: treat them as 0.
--
-- security invoker: the function runs with the caller's rights, so the
-- existing RLS and GRANTs on public.likes (select for anon and authenticated)
-- still decide what can be read. search_path is emptied so nothing can be
-- hijacked through a look-alike table.

create function public.get_like_counts(post_ids uuid[])
returns table (post_id uuid, like_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.post_id, count(*)::bigint as like_count
  from public.likes l
  where l.post_id = any (post_ids)
  group by l.post_id;
$$;

-- Explicit execute rights, like the explicit table GRANTs in 0003.
revoke all on function public.get_like_counts(uuid[]) from public;
grant execute on function public.get_like_counts(uuid[]) to anon, authenticated;