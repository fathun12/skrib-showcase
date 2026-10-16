-- Story Share: the passage a note quotes from the story it shares.
begin;

create table public.note_story_quotes (
  note_id uuid primary key references public.notes (id) on delete cascade,
  quote text not null,
  constraint note_story_quotes_len check (char_length(quote) between 1 and 300)
);

alter table public.note_story_quotes enable row level security;
revoke all on public.note_story_quotes from anon, authenticated;
grant select (note_id, quote) on public.note_story_quotes to anon, authenticated;
grant insert (note_id, quote) on public.note_story_quotes to authenticated;

-- Readable only while the note AND its story are visible to the viewer.
create policy "story quotes follow note and story visibility"
  on public.note_story_quotes for select to anon, authenticated
  using (exists (
    select 1
    from public.notes n
    join public.posts p on p.id = n.shared_post_id
    where n.id = note_story_quotes.note_id
  ));

-- Only on my own new note that shares a story.
create policy "authors add a quote to their new shared note"
  on public.note_story_quotes for insert to authenticated
  with check (exists (
    select 1 from public.notes n
    where n.id = note_story_quotes.note_id
      and n.author_id = (select auth.uid())
      and n.shared_post_id is not null
      and n.created_at > now() - interval '2 minutes'
  ));

create policy suspended_no_insert_note_story_quotes
  on public.note_story_quotes as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));

commit;