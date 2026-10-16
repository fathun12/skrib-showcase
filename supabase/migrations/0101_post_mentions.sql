-- 0101_post_mentions.sql
-- Run after 0100.
-- Mentions in stories (Tiptap node "mention", attrs id = user id). A trigger
-- on posts reads the published text; a mention is announced once per story
-- and person, never from a draft.
begin;

-- The user ids of the mention nodes of a Tiptap document, in order of
-- appearance, at most 10 distinct ones. Text that is not a uuid is ignored.
create function private.doc_mention_ids(p_doc jsonb)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  with recursive walk(node, sort_key) as (
    select p_doc, ''::text
    union all
    select c.value, w.sort_key || lpad(c.ord::text, 6, '0')
    from walk w
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(w.node -> 'content') = 'array'
           then w.node -> 'content' else '[]'::jsonb end
    ) with ordinality as c(value, ord)
  ),
  found as (
    select case
             when (w.node #>> '{attrs,id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then (w.node #>> '{attrs,id}')::uuid
           end as id,
           w.sort_key
    from walk w
    where w.node ->> 'type' = 'mention'
  ),
  firsts as (
    select f.id, min(f.sort_key) as first_key
    from found f
    where f.id is not null
    group by f.id
    order by min(f.sort_key)
    limit 10
  )
  select coalesce(array_agg(s.id order by s.first_key), '{}'::uuid[])
  from firsts s
$$;

create table public.post_mentions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create index post_mentions_user_idx on public.post_mentions (user_id);

alter table public.post_mentions enable row level security;

create policy "post mentions are seen by the mentioned person and the authors"
  on public.post_mentions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.posts p
      where p.id = post_mentions.post_id
        and p.author_id = (select auth.uid())
    )
    or exists (
      select 1 from public.post_collaborators c
      where c.post_id = post_mentions.post_id
        and c.user_id = (select auth.uid())
        and c.status = 'accepted'
    )
  );

-- Nobody writes through the API: only the trigger below does.
revoke all on public.post_mentions from public, anon, authenticated;
grant select on public.post_mentions to authenticated;

-- New notification type: post_mention (it points at a post).
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type = any (array[
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like',
    'note_mention', 'note_repost', 'note_quote', 'story_share',
    'comment_mention', 'handover_to_author', 'handover_to_editor',
    'editor_published', 'post_mention'
  ]));

alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications add constraint notifications_post_matches_type
  check ((type = any (array[
    'like', 'comment', 'reply', 'repost', 'credit', 'credit_accepted',
    'credit_declined', 'comment_mention', 'handover_to_author',
    'handover_to_editor', 'editor_published', 'post_mention'
  ])) = (post_id is not null));

-- Runs only for PUBLISHED stories (the WHEN clause), so an autosave of a
-- draft never gets here and never notifies. The bell row exists only for a
-- post_mentions row that was really inserted: a repeat after an Update, or
-- after unpublish and publish again, notifies nobody twice.
create function private.sync_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := private.doc_mention_ids(new.content);
begin
  -- Names that were taken out of the text (their bell rows stay).
  delete from public.post_mentions m
  where m.post_id = new.id
    and not (m.user_id = any (v_ids));

  with fresh as (
    insert into public.post_mentions (post_id, user_id)
    select new.id, p.id
    from public.profiles p
    where p.id = any (v_ids)
      -- no self-mention, no accepted co-author
      and p.id <> new.author_id
      and not exists (
        select 1 from public.post_collaborators c
        where c.post_id = new.id
          and c.user_id = p.id
          and c.status = 'accepted'
      )
      -- nobody who blocked the owner
      and not exists (
        select 1 from public.note_blocks b
        where b.blocker_id = p.id and b.blocked_id = new.author_id
      )
    on conflict do nothing
    returning user_id
  )
  insert into public.notifications (recipient_id, actor_id, type, post_id)
  select f.user_id, new.author_id, 'post_mention', new.id
  from fresh f
  -- a person who muted the owner gets no notification
  where not exists (
    select 1 from public.note_mutes u
    where u.muter_id = f.user_id and u.muted_id = new.author_id
  )
  on conflict do nothing;

  return null;
end;
$$;

revoke all on function private.doc_mention_ids(jsonb)
  from public, anon, authenticated;
revoke all on function private.sync_post_mentions()
  from public, anon, authenticated;

create trigger sync_post_mentions
  after insert or update of content, status
  on public.posts
  for each row
  when (new.status = 'published')
  execute function private.sync_post_mentions();

commit;