-- 0037_post_search.sql
-- Search: a stored tsvector kept by a trigger (published posts only), a GIN
-- index and the search function. Text config 'simple' works for every
-- language of the app.

begin;

alter table public.posts add column search_vector tsvector;

-- All text nodes of a Tiptap document, in document order. The path (position
-- of each node among its siblings) keeps the order right for phrase search.
create function private.doc_text(p_content jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  with recursive walk(node, path) as (
    select p_content, array[]::int[]
    union all
    select c.child, walk.path || c.ord::int
    from walk,
         jsonb_array_elements(
           case when jsonb_typeof(walk.node -> 'content') = 'array'
                then walk.node -> 'content' else '[]'::jsonb end
         ) with ordinality as c(child, ord)
  )
  select coalesce(string_agg(node ->> 'text', ' ' order by path), '')
  from walk
  where node ->> 'type' = 'text'
$$;

-- Title and tags weigh A, subtitle B, body D.
create function private.build_post_search_vector(
  p_title text, p_subtitle text, p_tags text[], p_content jsonb
)
returns tsvector
language sql
immutable
set search_path = ''
as $$
  select setweight(to_tsvector('simple', coalesce(p_title, '')), 'A')
      || setweight(to_tsvector('simple', array_to_string(p_tags, ' ')), 'A')
      || setweight(to_tsvector('simple', coalesce(p_subtitle, '')), 'B')
      || setweight(to_tsvector('simple', private.doc_text(p_content)), 'D')
$$;

-- security definer (like the guard of 0012): the signed-in author may not
-- call the private helpers directly. It reads nothing else and only fills
-- new.search_vector. A draft or an unpublished post has no vector.
create function private.set_post_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    new.search_vector := private.build_post_search_vector(
      new.title, new.subtitle, new.tags, new.content
    );
  else
    new.search_vector := null;
  end if;
  return new;
end;
$$;

revoke all on function private.doc_text(jsonb)
  from public, anon, authenticated;
revoke all on function private.build_post_search_vector(text, text, text[], jsonb)
  from public, anon, authenticated;
revoke all on function private.set_post_search_vector()
  from public, anon, authenticated;

create trigger posts_set_search_vector
  before insert or update of title, subtitle, content, status, tags
  on public.posts
  for each row execute function private.set_post_search_vector();

-- Backfill the published posts. The trigger above does not fire for an update
-- of search_vector alone, so the value is computed directly. updated_at must
-- not change for every post (the sitemap uses it), so that trigger is off for
-- this one statement.
alter table public.posts disable trigger posts_set_updated_at;
update public.posts
set search_vector = private.build_post_search_vector(title, subtitle, tags, content)
where status = 'published';
alter table public.posts enable trigger posts_set_updated_at;

create index posts_search_idx on public.posts using gin (search_vector);

-- The search itself. security invoker: RLS shows only published posts to anon.
create function public.search_posts(
  p_query text, p_limit int default 11, p_offset int default 0
)
returns table (post_id uuid, rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id as post_id, ts_rank_cd(p.search_vector, q.query) as rank
  from public.posts p,
       (select websearch_to_tsquery('simple', left(coalesce(p_query, ''), 100)) as query) q
  where p.status = 'published'
    and p.search_vector @@ q.query
  order by rank desc, p.published_at desc, p.id desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0)
$$;

revoke all on function public.search_posts(text, int, int) from public;
grant execute on function public.search_posts(text, int, int) to anon, authenticated;

commit;