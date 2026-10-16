-- 0067: ranking for the Popular chip of the Notes tab.
-- Score: (likes + published replies + 1) / (age_in_hours + 2) ^ 1.5, same shape
-- as get_popular_post_ids. Top-level published notes of the last p_days days.
-- p_exclude: authors to leave out (muted people, people who blocked the viewer).
create function public.get_popular_note_ids(
  p_days integer,
  p_limit integer,
  p_exclude uuid[]
)
returns table(note_id uuid)
language sql
stable
set search_path to ''
as $$
  select n.id
  from public.notes n
  cross join lateral (
    select count(*) as c
    from public.note_likes l
    where l.note_id = n.id
  ) lk
  cross join lateral (
    select count(*) as c
    from public.notes r
    where r.reply_to_id = n.id
      and r.status = 'published'
  ) rp
  where n.status = 'published'
    and n.reply_to_id is null
    and n.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
    and not (n.author_id = any (coalesce(p_exclude, '{}'::uuid[])))
  order by
    (lk.c + rp.c + 1) / power(extract(epoch from (now() - n.created_at)) / 3600.0 + 2, 1.5) desc,
    n.created_at desc,
    n.id desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function public.get_popular_note_ids(integer, integer, uuid[]) from public;
grant execute on function public.get_popular_note_ids(integer, integer, uuid[]) to anon, authenticated;