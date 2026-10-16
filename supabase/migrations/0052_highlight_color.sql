-- 0052_highlight_color.sql
-- Run after 0051.
-- Reader highlights get a color, the same four names as the editor
-- (src/ui/editor/colors.ts). Existing rows become yellow.

begin;

alter table public.highlights
  add column color text not null default 'yellow'
  check (color in ('yellow', 'green', 'blue', 'pink'));

grant insert (color) on public.highlights to authenticated;

commit;