-- 0082_fix_mark_removed_quotes.sql
-- Deleting a note that another note quotes failed: the trigger set
-- quote_removed = true while quote_note_id was still filled, and the check
-- notes_quote_removed_valid forbids that. Both are set in one update now.

begin;

create or replace function private.mark_removed_quotes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notes
     set quote_removed = true,
         quote_note_id = null
   where quote_note_id = old.id;
  return old;
end;
$$;

commit;