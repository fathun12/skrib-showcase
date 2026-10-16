-- 0076_note_edit.sql
-- Editing a note: notes.edited_at, a column grant for body only, a trigger
-- that enforces the 30-minute window and sets edited_at, and the rate-limit
-- rule note_edit. The triggers for search, hashtags and mentions already fire
-- on update of body (0071 to 0073). A report keeps its own copy of the text
-- (report_note), so an edit never destroys evidence.

begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('note_edit', 30, 3600);

alter table public.notes add column edited_at timestamptz;

-- SELECT on notes is granted per column.
grant select (edited_at) on public.notes to anon, authenticated;
-- Only the text may be edited. edited_at is set by the trigger below, never
-- by the client. The existing update policy limits this to the author's rows
-- and the restrictive policy suspended_no_update_notes still applies.
grant update (body) on public.notes to authenticated;

-- Keep the 30 minutes in sync with NOTE_EDIT_MINUTES in
-- src/features/notes/schemas.ts.
create function private.guard_note_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is not distinct from old.body then
    return new;
  end if;
  if old.status <> 'published' then
    raise exception 'note_not_editable';
  end if;
  if now() > old.created_at + interval '30 minutes' then
    raise exception 'edit_window_closed';
  end if;
  new.edited_at := now();
  return new;
end;
$$;

revoke all on function private.guard_note_edit()
  from public, anon, authenticated;

create trigger notes_guard_edit
  before update of body
  on public.notes
  for each row execute function private.guard_note_edit();

commit;