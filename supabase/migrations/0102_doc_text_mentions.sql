-- 0102_doc_text_mentions.sql
-- Run after 0101.
-- A mention node has no `text`, so its name was missing from the search
-- vector. doc_text now reads the label of mention nodes too. No backfill:
-- no published story has a mention yet, and the search vector trigger
-- recomputes the vector whenever the content changes.
begin;

create or replace function private.doc_text(p_content jsonb)
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
  select coalesce(
    string_agg(
      case when node ->> 'type' = 'mention'
           then node #>> '{attrs,label}'
           else node ->> 'text' end,
      ' ' order by path
    ),
    ''
  )
  from walk
  where node ->> 'type' in ('text', 'mention')
$$;

commit;