-- 0028_repost_caption_report_default.sql
-- Run after 0027.
-- caption_text is always filled by the trigger fill_repost_caption_report
-- (clients cannot send it: no insert right on the column). The default only
-- lets the generated TypeScript types treat the column as optional.

begin;

alter table public.repost_caption_reports
  alter column caption_text set default '';

commit;