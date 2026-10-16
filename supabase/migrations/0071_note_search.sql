-- 0071_note_search.sql
-- Notes search: a stored tsvector kept by a trigger (published notes only),
-- a GIN index and the search function. Same pattern as 0037 (story search).

begin;

alter table public.notes add column search_vector tsvector;

-- security definer, like set_post_search_vector: it only fills
-- new.search_vector. A hidden note has no vector.
create function private.set_note_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    new.search_vector := to_tsvector('simple', new.body);
  else
    new.search_vector := null;
  end if;
  return new;
end;
$$;

revoke all on function private.set_note_search_vector()
  from public, anon, authenticated;

create trigger notes_set_search_vector
  before insert or update of body, status
  on public.notes
  for each row execute function private.set_note_search_vector();

-- Backfill the published notes (the trigger does not fire for an update of
-- search_vector alone, so the value is computed directly).
update public.notes
set search_vector = to_tsvector('simple', body)
where status = 'published';

create index notes_search_idx on public.notes using gin (search_vector);

-- SELECT on notes is granted per column, and search_notes runs as the caller.
grant select (search_vector) on public.notes to anon, authenticated;

-- security invoker: RLS still decides which notes the caller may see.
-- p_exclude = authors to leave out (muted, or who blocked the viewer).
create function public.search_notes(
  p_query text,
  p_limit int default 11,
  p_offset int default 0,
  p_exclude uuid[] default '{}'
)
returns table (note_id uuid, rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id as note_id, ts_rank_cd(n.search_vector, q.query) as rank
  from public.notes n,
       (select websearch_to_tsquery('simple', left(coalesce(p_query, ''), 100)) as query) q
  where n.status = 'published'
    and n.reply_to_id is null
    and n.search_vector @@ q.query
    and n.author_id <> all (coalesce(p_exclude, '{}'))
  order by rank desc, n.created_at desc, n.id desc
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0)
$$;

revoke all on function public.search_notes(text, int, int, uuid[]) from public;
grant execute on function public.search_notes(text, int, int, uuid[])
  to anon, authenticated;

commit;