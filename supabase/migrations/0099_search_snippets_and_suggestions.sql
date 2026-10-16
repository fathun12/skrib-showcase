-- 0099_search_snippets_and_suggestions.sql
-- Search for stories: a snippet with the matched words marked, and a
-- "Did you mean" suggestion built from the words that already exist in the
-- published stories (pg_trgm on a word list refreshed by the daily job).
-- The highlights suggestion comes in 0100.

begin;

create extension if not exists pg_trgm with schema extensions;

-- Snippets. security definer because private.doc_text is closed to the
-- caller; it reads only PUBLISHED posts and returns at most 11 of them. The
-- matched words are wrapped in U+E000 and U+E001, which cannot occur in a
-- story; the app splits on them and never renders HTML.
create function public.search_post_snippets(p_post_ids uuid[], p_query text)
returns table (post_id uuid, snippet text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id as post_id,
         ts_headline(
           'simple',
           private.doc_text(p.content),
           q.query,
           'StartSel=' || chr(57344) || ', StopSel=' || chr(57345)
             || ', MaxWords=28, MinWords=14, MaxFragments=1'
         ) as snippet
  from public.posts p,
       (select websearch_to_tsquery('simple', left(coalesce(p_query, ''), 100)) as query) q
  where p.id = any (p_post_ids[1:11])
    and p.status = 'published'
    and numnode(q.query) > 0
$$;

revoke all on function public.search_post_snippets(uuid[], text) from public;
grant execute on function public.search_post_snippets(uuid[], text)
  to anon, authenticated;

-- The word list: every word of the published stories with the number of
-- stories that contain it. Words shorter than 4 characters or with a digit
-- are left out. Lives in the private schema; only the functions below read it.
create materialized view private.search_words as
select word, ndoc
from ts_stat($q$
  select search_vector from public.posts
  where status = 'published' and search_vector is not null
$q$)
where char_length(word) >= 4
  and word !~ '[0-9]';

create unique index search_words_word_idx on private.search_words (word);
create index search_words_trgm_idx
  on private.search_words using gin (word extensions.gin_trgm_ops);

revoke all on private.search_words from public, anon, authenticated;

-- Called by the daily job (service role only).
create function public.refresh_search_words()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently private.search_words;
end;
$$;

revoke all on function public.refresh_search_words()
  from public, anon, authenticated;
grant execute on function public.refresh_search_words() to service_role;

-- "Did you mean": each word that is NOT in the list (and has 4 or more
-- characters) is replaced by the most similar word of the list when the
-- similarity is 0.4 or more. Returns the rebuilt query, or null when nothing
-- was replaced. At most 8 words of the first 100 characters.
create function public.suggest_search_query(p_query text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_word text;
  v_fix text;
  v_out text[] := '{}';
  v_changed boolean := false;
begin
  for v_word in
    select w
    from regexp_split_to_table(
           lower(left(coalesce(p_query, ''), 100)), '[^[:alnum:]]+'
         ) as w
    where w <> ''
    limit 8
  loop
    v_fix := null;
    if char_length(v_word) >= 4
       and not exists (
         select 1 from private.search_words s where s.word = v_word
       ) then
      select s.word into v_fix
      from private.search_words s
      where s.word operator(extensions.%) v_word
        and extensions.similarity(s.word, v_word) >= 0.4
      order by extensions.similarity(s.word, v_word) desc, s.ndoc desc, s.word
      limit 1;
    end if;
    if v_fix is not null then
      v_changed := true;
      v_out := v_out || v_fix;
    else
      v_out := v_out || v_word;
    end if;
  end loop;

  if not v_changed then
    return null;
  end if;
  return array_to_string(v_out, ' ');
end;
$$;

revoke all on function public.suggest_search_query(text) from public;
grant execute on function public.suggest_search_query(text)
  to anon, authenticated;

commit;