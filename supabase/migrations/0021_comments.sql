-- 0021_comments.sql
-- Run after 0020.
-- Comments on published posts with one level of replies, comment reports,
-- and two new notification types (comment, reply).

begin;

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  -- Filled by the database from the session; the app never sends it.
  author_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  -- NULL = top-level comment. A reply points to a top-level comment.
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_length
    check (char_length(body) <= 1000 and char_length(btrim(body)) >= 1)
);

create index comments_post_created_idx on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_id)
  where parent_id is not null;
create index comments_author_idx on public.comments (author_id);

alter table public.comments enable row level security;

-- Decision 22: start from nothing, then grant exactly what is needed.
-- INSERT is per column: author_id and created_at always come from the database.
-- No UPDATE on purpose (no editing).
revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (post_id, parent_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

-- Comments of an unpublished post are hidden (and come back if it is republished).
create policy "comments_select_published"
  on public.comments for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

create policy "comments_insert_own"
  on public.comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.status = 'published'
    )
  );

-- The writer, the owner of the post and accepted co-authors may delete.
create policy "comments_delete"
  on public.comments for delete
  to authenticated
  using (
    author_id = (select auth.uid())
    or private.is_post_owner(post_id)
    or private.is_accepted_coauthor(post_id)
  );

-- Checks that a policy cannot express: reply rules and a cap per person and post.
create function private.check_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_post uuid;
  v_parent_parent uuid;
begin
  if new.parent_id is not null then
    select c.post_id, c.parent_id
      into v_parent_post, v_parent_parent
    from public.comments c
    where c.id = new.parent_id;

    -- The parent must exist, be on the same post and be a top-level comment.
    if v_parent_post is null
       or v_parent_post <> new.post_id
       or v_parent_parent is not null then
      raise exception 'comment_bad_parent';
    end if;
  end if;

  if (select count(*) from public.comments c
      where c.post_id = new.post_id and c.author_id = new.author_id) >= 20 then
    raise exception 'comment_post_limit';
  end if;

  return new;
end;
$$;

revoke all on function private.check_comment_insert() from public;

create trigger check_comment_insert
  before insert on public.comments
  for each row execute function private.check_comment_insert();

-- Reports on comments (separate from public.reports, which stays untouched).
create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint comment_reports_reason_valid
    check (reason in ('spam', 'harassment', 'inappropriate', 'illegal', 'other')),
  constraint comment_reports_details_length
    check (details is null or char_length(details) between 1 and 500),
  constraint comment_reports_status_valid
    check (status in ('open', 'resolved', 'dismissed')),
  constraint comment_reports_one_per_user unique (reporter_id, comment_id)
);

create index comment_reports_status_created_idx
  on public.comment_reports (status, created_at desc);

alter table public.comment_reports enable row level security;
revoke all on public.comment_reports from anon, authenticated;
grant insert (comment_id, reason, details) on public.comment_reports to authenticated;

-- Nobody reads reports through the API; the owner reads them in the Table Editor.
create policy "comment_reports_insert_own"
  on public.comment_reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1
      from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_id
        and p.status = 'published'
        and c.author_id <> (select auth.uid())
    )
  );

-- Notifications: two new types. The dedupe index of 0019 stays: one
-- notification per recipient, actor, type and post.
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications
  add constraint notifications_type_valid
    check (type in ('follow', 'like', 'comment', 'reply'));
alter table public.notifications
  add constraint notifications_post_matches_type
    check ((type in ('like', 'comment', 'reply')) = (post_id is not null));

create function private.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  if new.parent_id is null then
    select p.author_id into v_post_author
    from public.posts p where p.id = new.post_id;

    -- Nobody is notified about their own comment.
    if v_post_author is not null and v_post_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (v_post_author, new.author_id, 'comment', new.post_id)
      on conflict do nothing;
    end if;
  else
    select c.author_id into v_parent_author
    from public.comments c where c.id = new.parent_id;

    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (v_parent_author, new.author_id, 'reply', new.post_id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_on_comment() from public;

create trigger notify_on_comment
  after insert on public.comments
  for each row execute function private.notify_on_comment();

-- Comment counts for many posts in one query (like get_like_counts).
-- Posts without comments are absent from the result: treat them as 0.
create function public.get_comment_counts(post_ids uuid[])
returns table (post_id uuid, comment_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.post_id, count(*)::bigint as comment_count
  from public.comments c
  where c.post_id = any (post_ids)
  group by c.post_id;
$$;

revoke all on function public.get_comment_counts(uuid[]) from public;
grant execute on function public.get_comment_counts(uuid[]) to anon, authenticated;

-- Rate limit rules (migration 0007): 20 comments per 10 minutes, 30 deletes per 10 minutes.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('comment', 20, 600), ('comment_delete', 30, 600)
on conflict (action) do nothing;

commit;