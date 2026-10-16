begin;

-- Who a comment mentions (same idea as note_mentions).
create table public.comment_mentions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (comment_id, user_id)
);
create index comment_mentions_user_idx on public.comment_mentions (user_id);

alter table public.comment_mentions enable row level security;

create policy "comment mentions follow comment visibility"
  on public.comment_mentions
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.comments c where c.id = comment_mentions.comment_id
    )
  );

revoke all on public.comment_mentions from public, anon, authenticated;
grant select on public.comment_mentions to anon, authenticated;

-- New notification type: comment_mention (it points at a post, like comment).
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid
  check (type = any (array[
    'follow', 'like', 'comment', 'reply', 'repost', 'credit',
    'credit_accepted', 'credit_declined', 'note_reply', 'note_like',
    'note_mention', 'note_repost', 'note_quote', 'story_share',
    'comment_mention'
  ]));

alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications add constraint notifications_post_matches_type
  check (
    (type = any (array[
      'like', 'comment', 'reply', 'repost', 'credit',
      'credit_accepted', 'credit_declined', 'comment_mention'
    ])) = (post_id is not null)
  );

-- Comments cannot be edited, so INSERT is enough. This trigger is named so
-- that it fires AFTER notify_on_comment (alphabetical order): the check for
-- an existing comment or reply notification below depends on that.
create or replace function private.sync_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_author uuid;
begin
  select c.author_id into v_parent_author
  from public.comments c
  where c.id = new.parent_id;

  -- Same rules as notes: no self-mention, nobody who blocked the writer.
  insert into public.comment_mentions (comment_id, user_id)
  select new.id, p.id
  from public.profiles p
  where p.username = any (private.extract_note_mentions(new.body))
    and p.id <> new.author_id
    and not exists (
      select 1 from public.note_blocks b
      where b.blocker_id = p.id and b.blocked_id = new.author_id
    );

  insert into public.notifications (recipient_id, actor_id, type, post_id)
  select m.user_id, new.author_id, 'comment_mention', new.post_id
  from public.comment_mentions m
  where m.comment_id = new.id
    -- a person who muted the writer gets no notification
    and not exists (
      select 1 from public.note_mutes u
      where u.muter_id = m.user_id and u.muted_id = new.author_id
    )
    -- the person I am replying to already gets a "reply" row
    and m.user_id is distinct from v_parent_author
    -- already notified by this same comment (post owner or co-author)
    and not exists (
      select 1 from public.notifications n
      where n.recipient_id = m.user_id
        and n.actor_id = new.author_id
        and n.post_id = new.post_id
        and n.type in ('comment', 'reply')
        and n.created_at >= new.created_at
    )
  on conflict do nothing;

  return null;
end;
$$;

revoke all on function private.sync_comment_mentions() from public, anon, authenticated;

create trigger sync_comment_mentions
  after insert on public.comments
  for each row execute function private.sync_comment_mentions();

commit;