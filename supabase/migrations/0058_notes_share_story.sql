-- Share a story into a note (round N2c).
begin;

-- The column was not grantable until now (0055 left it out on purpose).
grant insert (shared_post_id) on public.notes to authenticated;

-- A shared story must be published. Restrictive: it adds to the insert policies.
create policy notes_shared_post_published on public.notes
  as restrictive for insert to authenticated
  with check (
    shared_post_id is null
    or exists (
      select 1 from public.posts p
      where p.id = shared_post_id and p.status = 'published'
    )
  );

commit;