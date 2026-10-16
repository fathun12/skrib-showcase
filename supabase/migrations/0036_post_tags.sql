-- 0036_post_tags.sql
-- Topics (tags) for posts: a text[] column, a CHECK that mirrors
-- src/ui/tags.ts, a partial GIN index and the popular-tags function.

begin;

alter table public.posts
  add column tags text[] not null default '{}';

-- At most 5 tags; each 2 to 30 characters of a-z, 0-9 and hyphens, with no
-- hyphen at either end. The regex works on the joined text, so no function
-- is needed in the CHECK. array_to_string() silently skips NULL elements, so
-- they are refused on their own, and the comma count must equal the element
-- count minus one, so one element cannot smuggle in two tags ("ab,cd").
-- Keep in sync with src/ui/tags.ts.
alter table public.posts
  add constraint posts_tags_format check (
    cardinality(tags) <= 5
    and array_position(tags, null) is null
    and length(array_to_string(tags, ','))
        - length(replace(array_to_string(tags, ','), ',', ''))
        = greatest(cardinality(tags) - 1, 0)
    and (
      cardinality(tags) = 0
      or array_to_string(tags, ',') ~
        '^[a-z0-9][a-z0-9-]{0,28}[a-z0-9](,[a-z0-9][a-z0-9-]{0,28}[a-z0-9]){0,4}$'
    )
  );

create index posts_tags_idx on public.posts using gin (tags)
  where status = 'published';

-- Popular tags, and tags starting with a prefix (editor suggestions).
-- security invoker: RLS applies; the explicit status filter keeps drafts of
-- the signed-in author out of the counts. starts_with() has no wildcards, so
-- a typed % or _ is just a character.
create function public.get_tag_counts(p_prefix text default '', p_limit int default 30)
returns table (tag text, post_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t as tag, count(*) as post_count
  from public.posts p, unnest(p.tags) as t
  where p.status = 'published'
    and starts_with(t, lower(left(coalesce(p_prefix, ''), 30)))
  group by t
  order by count(*) desc, t
  limit least(greatest(p_limit, 1), 50)
$$;

revoke all on function public.get_tag_counts(text, int) from public;
grant execute on function public.get_tag_counts(text, int) to anon, authenticated;

-- Rate limit for the suggestion calls from the editor (pattern of 0007).
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('tag_suggest', 60, 60)
on conflict (action) do nothing;

commit;