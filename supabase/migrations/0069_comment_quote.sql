-- Respond: a public comment may quote a passage of the story.
-- Only top-level comments carry a quote (replies never do).
alter table public.comments add column quote text;

alter table public.comments
  add constraint comments_quote_length
  check (quote is null or (char_length(quote) between 1 and 300 and btrim(quote) <> ''));

alter table public.comments
  add constraint comments_quote_top_level
  check (quote is null or parent_id is null);

-- SELECT on this table is granted per column (anon and authenticated).
grant select (quote) on public.comments to anon, authenticated;
grant insert (quote) on public.comments to authenticated;