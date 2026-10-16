-- 0034_post_versions.sql
-- Run after 0033.
-- Version history of a post. The table lives in the schema "private": nobody
-- reads or writes it through the API, only through the functions below.
-- Who may use it: the post owner; on a shared post (accepted co-authors) only
-- the person who holds the pen.
-- Rules: an automatic version at most every 10 minutes; Publish, Update and
-- Restore always save one; an identical copy of the newest version is never
-- saved; the 30 newest versions per post are kept.

begin;

create table private.post_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  saved_by uuid references public.profiles (id) on delete set null,
  reason text not null,
  title text not null,
  subtitle text,
  content jsonb not null,
  language text not null,
  word_count integer not null,
  created_at timestamptz not null default now(),
  constraint post_versions_reason_valid
    check (reason in ('auto', 'publish', 'update', 'restore'))
);

create index post_versions_post_created_idx
  on private.post_versions (post_id, created_at desc);

alter table private.post_versions enable row level security;
revoke all on private.post_versions from public, anon, authenticated;

-- ---------- who may use the history ----------
create function private.can_use_history(p_post_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_author(p_post_id, p_user_id)
    and (
      not exists (
        select 1 from public.post_collaborators c
        where c.post_id = p_post_id and c.status = 'accepted'
      )
      or exists (
        select 1 from private.post_edit_locks l
        where l.post_id = p_post_id and l.holder_id = p_user_id
      )
    );
$$;

revoke all on function private.can_use_history(uuid, uuid)
  from public, anon, authenticated;

-- ---------- save a version of the post as it is stored now ----------
-- Returns true when a version was written, false when it was skipped.
create function private.save_post_version(p_post_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_post public.posts%rowtype;
  v_last private.post_versions%rowtype;
  v_text text;
  v_words integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_reason is null or p_reason not in ('auto', 'publish', 'update', 'restore') then
    raise exception 'history_bad_input';
  end if;
  if not private.can_use_history(p_post_id, v_user) then
    raise exception 'history_not_allowed';
  end if;

  -- Two tabs saving at the same moment must not both write.
  perform pg_advisory_xact_lock(hashtextextended('post_version:' || p_post_id::text, 0));

  select * into v_post from public.posts p where p.id = p_post_id;
  if not found then
    raise exception 'history_not_allowed';
  end if;

  select * into v_last
  from private.post_versions v
  where v.post_id = p_post_id
  order by v.created_at desc, v.id desc
  limit 1;

  if found then
    if v_last.title = v_post.title
       and v_last.subtitle is not distinct from v_post.subtitle
       and v_last.content = v_post.content
       and v_last.language = v_post.language then
      return false;
    end if;
    if p_reason = 'auto' and v_last.created_at > now() - interval '10 minutes' then
      return false;
    end if;
  end if;

  -- All the text of the document, then a word count.
  with recursive walk(node) as (
    select v_post.content
    union all
    select child
    from walk,
         lateral jsonb_array_elements(
           case when jsonb_typeof(walk.node -> 'content') = 'array'
                then walk.node -> 'content' else '[]'::jsonb end
         ) as child
  )
  select string_agg(w.node ->> 'text', ' ')
    into v_text
  from walk w
  where w.node ->> 'type' = 'text';

  v_words := case
    when btrim(coalesce(v_text, '')) = '' then 0
    else array_length(regexp_split_to_array(btrim(v_text), '\s+'), 1)
  end;

  -- A blank first version is not worth keeping.
  if not found and btrim(v_post.title) = '' and v_words = 0 then
    return false;
  end if;

  insert into private.post_versions
    (post_id, saved_by, reason, title, subtitle, content, language, word_count)
  values
    (p_post_id, v_user, p_reason, v_post.title, v_post.subtitle,
     v_post.content, v_post.language, v_words);

  -- Keep the 30 newest.
  delete from private.post_versions d
  where d.post_id = p_post_id
    and d.id not in (
      select v.id from private.post_versions v
      where v.post_id = p_post_id
      order by v.created_at desc, v.id desc
      limit 30
    );

  return true;
end;
$$;

-- ---------- the list (no body, so it stays small) ----------
create function private.list_post_versions(p_post_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  reason text,
  saved_by_name text,
  title text,
  word_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.can_use_history(p_post_id, auth.uid()) then
    raise exception 'history_not_allowed';
  end if;

  return query
  select v.id, v.created_at, v.reason, pr.display_name, v.title, v.word_count
  from private.post_versions v
  left join public.profiles pr on pr.id = v.saved_by
  where v.post_id = p_post_id
  order by v.created_at desc, v.id desc;
end;
$$;

-- ---------- one version in full (preview and restore) ----------
create function private.get_post_version(p_version_id uuid)
returns table (
  id uuid,
  post_id uuid,
  created_at timestamptz,
  reason text,
  title text,
  subtitle text,
  content jsonb,
  language text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_post uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select v.post_id into v_post
  from private.post_versions v
  where v.id = p_version_id;

  if v_post is null or not private.can_use_history(v_post, auth.uid()) then
    raise exception 'history_not_allowed';
  end if;

  return query
  select v.id, v.post_id, v.created_at, v.reason, v.title, v.subtitle,
         v.content, v.language
  from private.post_versions v
  where v.id = p_version_id;
end;
$$;

-- ---------- the functions the app calls (security invoker) ----------
create function public.save_post_version(p_post_id uuid, p_reason text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.save_post_version(p_post_id, p_reason);
$$;

create function public.list_post_versions(p_post_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  reason text,
  saved_by_name text,
  title text,
  word_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_post_versions(p_post_id);
$$;

create function public.get_post_version(p_version_id uuid)
returns table (
  id uuid,
  post_id uuid,
  created_at timestamptz,
  reason text,
  title text,
  subtitle text,
  content jsonb,
  language text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_post_version(p_version_id);
$$;

revoke all on function private.save_post_version(uuid, text) from public, anon;
grant execute on function private.save_post_version(uuid, text) to authenticated;
revoke all on function private.list_post_versions(uuid) from public, anon;
grant execute on function private.list_post_versions(uuid) to authenticated;
revoke all on function private.get_post_version(uuid) from public, anon;
grant execute on function private.get_post_version(uuid) to authenticated;

revoke all on function public.save_post_version(uuid, text) from public, anon;
grant execute on function public.save_post_version(uuid, text) to authenticated;
revoke all on function public.list_post_versions(uuid) from public, anon;
grant execute on function public.list_post_versions(uuid) to authenticated;
revoke all on function public.get_post_version(uuid) from public, anon;
grant execute on function public.get_post_version(uuid) to authenticated;

-- Rate limit rule (migration 0007): 120 history actions an hour per user.
insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('post_history', 120, 3600)
on conflict (action) do nothing;

commit;