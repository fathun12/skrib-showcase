-- 0100_highlight_suggestions.sql
-- "Did you mean" for the search on /me/highlights. The words come from the
-- reader's OWN highlights and notes (security invoker: RLS shows only their
-- rows), the latest 2000 of them. Same rule as 0099: a word of 4 or more
-- characters that is not in the vocabulary is replaced by the most similar
-- word with similarity 0.4 or more. Returns the rebuilt text, or null when
-- nothing was replaced.

begin;

create function public.suggest_highlight_query(p_query text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  with recent as (
    select h.quote, h.note
    from public.highlights h
    order by h.created_at desc, h.id desc
    limit 2000
  ),
  vocab as (
    select w.word, count(*) as n
    from recent r,
         regexp_split_to_table(
           lower(r.quote || ' ' || coalesce(r.note, '')), '[^[:alnum:]]+'
         ) as w(word)
    where char_length(w.word) >= 4
      and w.word !~ '[0-9]'
    group by w.word
  ),
  asked as (
    select q.word, q.ord
    from regexp_split_to_table(
           lower(left(coalesce(p_query, ''), 100)), '[^[:alnum:]]+'
         ) with ordinality as q(word, ord)
    where q.word <> '' and q.ord <= 8
  ),
  fixed as (
    select a.ord, a.word,
           case
             when char_length(a.word) >= 4
                  and not exists (select 1 from vocab v where v.word = a.word)
             then (
               select v.word
               from vocab v
               where extensions.similarity(v.word, a.word) >= 0.4
               order by extensions.similarity(v.word, a.word) desc,
                        v.n desc, v.word
               limit 1
             )
           end as fix
    from asked a
  )
  select case
           when bool_or(f.fix is not null)
           then string_agg(coalesce(f.fix, f.word), ' ' order by f.ord)
         end
  from fixed f
$$;

revoke all on function public.suggest_highlight_query(text) from public, anon;
grant execute on function public.suggest_highlight_query(text) to authenticated;

commit;