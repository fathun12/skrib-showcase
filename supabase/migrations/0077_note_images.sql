-- 0077: images on notes (up to 4 per note). Stored as rows, never inside the note text.
create table public.note_images (
  note_id uuid not null references public.notes (id) on delete cascade,
  position integer not null,
  url text not null,
  width integer not null default 0,
  height integer not null default 0,
  alt text,
  primary key (note_id, position),
  constraint note_images_position_valid check (position between 0 and 3),
  constraint note_images_url_valid check (
    char_length(url) <= 500 and url like 'https://res.cloudinary.com/%'
  ),
  constraint note_images_alt_valid check (
    alt is null or char_length(alt) between 1 and 200
  ),
  constraint note_images_size_valid check (
    width between 0 and 20000 and height between 0 and 20000
  )
);

alter table public.note_images enable row level security;

revoke all on public.note_images from anon, authenticated;
grant select (note_id, position, url, width, height, alt)
  on public.note_images to anon, authenticated;
grant insert (note_id, position, url, width, height, alt)
  on public.note_images to authenticated;

-- Readable exactly when the note is readable (RLS of notes applies inside).
create policy "note images follow note visibility"
  on public.note_images for select to anon, authenticated
  using (exists (select 1 from public.notes n where n.id = note_images.note_id));

-- Only the author, and only in the first 2 minutes after the note was created
-- (editing a note never changes its images).
create policy "authors add images to their new notes"
  on public.note_images for insert to authenticated
  with check (exists (
    select 1 from public.notes n
    where n.id = note_images.note_id
      and n.author_id = (select auth.uid())
      and n.created_at > now() - interval '2 minutes'
  ));

create policy suspended_no_insert_note_images
  on public.note_images as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));