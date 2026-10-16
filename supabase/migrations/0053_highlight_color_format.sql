-- 0053_highlight_color_format.sql
-- Run after 0052.
-- The allowed color names live in the app (src/ui/editor/colors.ts), like
-- the editor. The database only checks the shape of the name, so adding a
-- color needs no migration.

begin;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.highlights'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%yellow%'
  loop
    execute format('alter table public.highlights drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.highlights
  add constraint highlights_color_format check (color ~ '^[a-z]{3,20}$');

commit;