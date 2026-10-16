-- 0072_note_hashtags.sql
-- Hashtags in notes: note_tags is filled by a trigger from the note text
-- (same slug rule as posts.tags, max 5 distinct per note), plus the list,
-- count and trending functions.

begin;

-- First 5 distinct hashtags of a text, in order of appearance. Keep in sync
-- with HASHTAG_PATTERN in src/ui/notes/NoteBody.tsx.
create function private.extract_note_tags(p_body text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(f.tag order by f.first_pos), '{}'::text[])
  from (
    select (m.arr)[1] as tag, min(m.ord) as first_pos
    from regexp_matches(
           lower(coalesce(p_body, '')),
           '(?:^|[^[:alnum:]_&/#-])#([a-z0-9][a-z0-9-]{0,28}[a-z0-9])(?![[:alnum:]_-])',
           'g'
         ) with ordinality as m(arr, ord)
    group by (m.arr)[1]
    order by min(m.ord)
    limit 5
  ) f
$$;

create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag text not null,
  primary key (note_id, tag),
  constraint note_tags_format check (tag ~ '^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$')
);

create index note_tags_tag_idx on public.note_tags (tag);

alter table public.note_tags enable row level security;

-- A tag row is visible when its note is visible (RLS of notes applies).
create policy "note tags follow note visibility"
  on public.note_tags for select
  using (exists (select 1 from public.notes n where n.id = note_tags.note_id));

-- Nobody writes through the API: only the trigger below does.
revoke all on public.note_tags from anon, authenticated;
grant select on public.note_tags to anon, authenticated;

create function private.sync_note_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.note_tags where note_id = new.id;
  end if;
  insert into public.note_tags (note_id, tag)
  select new.id, t
  from unnest(private.extract_note_tags(new.body)) as t;
  return null;
end;
$$;

revoke all on function private.extract_note_tags(text)
  from public, anon, authenticated;
revoke all on function private.sync_note_tags()
  from public, anon, authenticated;

create trigger notes_sync_tags
  after insert or update of body
  on public.notes
  for each row execute function private.sync_note_tags();

-- Backfill the notes that already exist.
insert into public.note_tags (note_id, tag)
select n.id, x.tag
from public.notes n
cross join lateral unnest(private.extract_note_tags(n.body)) as x(tag);

-- Newest notes with a hashtag, keyset order like get_following_notes.
create function public.get_tagged_note_ids(
  p_tag text,
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit integer,
  p_exclude uuid[]
)
returns table (note_id uuid, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id, n.created_at
  from public.note_tags t
  join public.notes n on n.id = t.note_id
  where t.tag = p_tag
    and n.status = 'published'
    and n.reply_to_id is null
    and not (n.author_id = any (coalesce(p_exclude, '{}'::uuid[])))
    and (
      p_after_at is null
      or (n.created_at, n.id) < (p_after_at, p_after_id)
    )
  order by n.created_at desc, n.id desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Popular notes with a hashtag: same score as get_popular_note_ids (0067).
create function public.get_popular_tagged_note_ids(
  p_tag text,
  p_days integer,
  p_limit integer,
  p_exclude uuid[]
)
returns table (note_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id
  from public.note_tags t
  join public.notes n on n.id = t.note_id
  cross join lateral (
    select count(*) as c from public.note_likes l where l.note_id = n.id
  ) lk
  cross join lateral (
    select count(*) as c
    from public.notes r
    where r.reply_to_id = n.id and r.status = 'published'
  ) rp
  where t.tag = p_tag
    and n.status = 'published'
    and n.reply_to_id is null
    and n.created_at > now() - make_interval(days => least(greatest(p_days, 1), 90))
    and not (n.author_id = any (coalesce(p_exclude, '{}'::uuid[])))
  order by
    (lk.c + rp.c + 1) / power(extract(epoch from (now() - n.created_at)) / 3600.0 + 2, 1.5) desc,
    n.created_at desc,
    n.id desc
  limit least(greatest(p_limit, 1), 100);
$$;

create function public.get_note_tag_count(p_tag text, p_exclude uuid[])
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::bigint
  from public.note_tags t
  join public.notes n on n.id = t.note_id
  where t.tag = p_tag
    and n.status = 'published'
    and n.reply_to_id is null
    and not (n.author_id = any (coalesce(p_exclude, '{}'::uuid[])));
$$;

-- Trending hashtags (used by the Explore page later). A tag needs at least
-- p_min_notes notes by at least p_min_authors different authors, so one
-- person cannot push a tag alone.
create function public.get_trending_note_tags(
  p_hours integer,
  p_limit integer,
  p_min_notes integer,
  p_min_authors integer,
  p_exclude uuid[]
)
returns table (tag text, note_count bigint, author_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.tag,
         count(*)::bigint as note_count,
         count(distinct n.author_id)::bigint as author_count
  from public.note_tags t
  join public.notes n on n.id = t.note_id
  where n.status = 'published'
    and n.reply_to_id is null
    and n.created_at > now() - make_interval(hours => least(greatest(p_hours, 1), 720))
    and not (n.author_id = any (coalesce(p_exclude, '{}'::uuid[])))
  group by t.tag
  having count(*) >= greatest(p_min_notes, 1)
     and count(distinct n.author_id) >= greatest(p_min_authors, 1)
  order by count(*) desc, count(distinct n.author_id) desc, t.tag
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.get_tagged_note_ids(text, timestamptz, uuid, integer, uuid[]) from public;
revoke all on function public.get_popular_tagged_note_ids(text, integer, integer, uuid[]) from public;
revoke all on function public.get_note_tag_count(text, uuid[]) from public;
revoke all on function public.get_trending_note_tags(integer, integer, integer, integer, uuid[]) from public;

grant execute on function public.get_tagged_note_ids(text, timestamptz, uuid, integer, uuid[]) to anon, authenticated;
grant execute on function public.get_popular_tagged_note_ids(text, integer, integer, uuid[]) to anon, authenticated;
grant execute on function public.get_note_tag_count(text, uuid[]) to anon, authenticated;
grant execute on function public.get_trending_note_tags(integer, integer, integer, integer, uuid[]) to anon, authenticated;

commit;