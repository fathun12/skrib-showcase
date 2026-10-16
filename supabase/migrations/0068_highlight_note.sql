-- Private note on a highlight (only the reader sees it, like the highlight).
alter table public.highlights add column note text;

alter table public.highlights
  add constraint highlights_note_length
  check (note is null or char_length(note) between 1 and 500);

-- Column grants: select is granted per column in this table, so the new
-- column needs its own select grant. Only note and color can be updated.
grant select (note) on public.highlights to authenticated;
grant update (note, color) on public.highlights to authenticated;

create policy highlights_update_own
  on public.highlights
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A suspended account cannot change its highlights.
create policy suspended_no_update_highlights
  on public.highlights
  as restrictive
  for update
  to authenticated
  using (not (select private.is_suspended()));