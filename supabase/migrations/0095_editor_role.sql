-- 0095_editor_role.sql
-- Run after 0094.
-- Editorial, round E1: a second kind of collaborator, the EDITOR.
-- An editor can take the pen and edit a DRAFT of somebody else's post, but is
-- not an author: not in the byline, not on profiles, not in the feeds, no like
-- or comment notifications. An editor can never change the text of a
-- PUBLISHED post (opened again in round E4). Publish stays owner-only.
-- Existing rows become role 'coauthor', so nothing changes for them.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.post_collaborators
  add column role text not null default 'coauthor',
  add column show_credit boolean not null default true;

alter table public.post_collaborators
  add constraint post_collaborators_role_valid
  check (role in ('coauthor', 'editor'));

grant insert (role, show_credit) on public.post_collaborators to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helpers: co-author (author) versus collaborator (any role)
-- ---------------------------------------------------------------------------
create or replace function private.is_accepted_coauthor(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.post_collaborators c
    where c.post_id = p_post_id
      and c.user_id = (select auth.uid())
      and c.status = 'accepted'
      and c.role = 'coauthor'
  );
$$;

create function private.is_accepted_collaborator(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.post_collaborators c
    where c.post_id = p_post_id
      and c.user_id = (select auth.uid())
      and c.status = 'accepted'
  );
$$;

revoke all on function private.is_accepted_collaborator(uuid) from public, anon;
grant execute on function private.is_accepted_collaborator(uuid) to authenticated;

-- Every accepted collaborator (editors too) may READ the draft.
drop policy "co-authors read shared posts" on public.posts;

create policy "co-authors read shared posts"
  on public.posts
  for select
  to authenticated
  using (private.is_accepted_collaborator(id));

-- ---------------------------------------------------------------------------
-- 3. Invitation limits: at most 2 editors per post (total stays 3)
-- ---------------------------------------------------------------------------
create or replace function private.check_collaborator_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_username text;
  v_count integer;
begin
  select p.author_id into v_owner
  from public.posts p
  where p.id = new.post_id;

  if not found then
    raise exception 'collab_post_not_found';
  end if;

  -- auth.uid() is null in the SQL Editor (admin); a signed-in caller who is
  -- not the owner gets the same answer as for a missing post.
  if auth.uid() is not null and auth.uid() <> v_owner then
    raise exception 'collab_post_not_found';
  end if;

  -- Lock the post row, so two invites sent at the same moment cannot both
  -- pass the cap of 3.
  perform 1 from public.posts p where p.id = new.post_id for update;

  if new.user_id = v_owner then
    raise exception 'collab_self';
  end if;

  select pr.username into v_username
  from public.profiles pr
  where pr.id = new.user_id;

  if v_username is null then
    raise exception 'collab_not_onboarded';
  end if;

  -- Pending and accepted count together (decision D5).
  select count(*) into v_count
  from public.post_collaborators c
  where c.post_id = new.post_id;

  if v_count >= 3 then
    raise exception 'collab_post_limit';
  end if;

  if new.role = 'editor' then
    select count(*) into v_count
    from public.post_collaborators c
    where c.post_id = new.post_id and c.role = 'editor';

    if v_count >= 2 then
      raise exception 'collab_editor_limit';
    end if;
  end if;

  -- Anti-spam: at most 20 pending invitations received per person.
  perform pg_advisory_xact_lock(
    hashtextextended('collab_invitee:' || new.user_id::text, 0)
  );

  select count(*) into v_count
  from public.post_collaborators c
  where c.user_id = new.user_id and c.status = 'pending';

  if v_count >= 20 then
    raise exception 'collab_invitee_limit';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Write guard: an editor may not change a PUBLISHED post
-- ---------------------------------------------------------------------------
create or replace function private.guard_shared_post_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  -- SQL Editor / admin.
  if v_user is null then
    return new;
  end if;

  if new.title is not distinct from old.title
     and new.subtitle is not distinct from old.subtitle
     and new.content is not distinct from old.content
     and new.language is not distinct from old.language
     and (
       new.cover_image_url is not distinct from old.cover_image_url
       or old.status <> 'published'
       or new.status <> 'published'
     ) then
    return new;
  end if;

  if not exists (
    select 1
    from public.post_collaborators c
    where c.post_id = old.id and c.status = 'accepted'
  ) then
    return new;
  end if;

  -- An accepted editor never changes a published post (round E4 may open it).
  if old.status = 'published' and exists (
    select 1
    from public.post_collaborators c
    where c.post_id = old.id
      and c.user_id = v_user
      and c.status = 'accepted'
      and c.role = 'editor'
  ) then
    raise exception 'collab_editor_published';
  end if;

  if not exists (
    select 1
    from private.post_edit_locks l
    where l.post_id = old.id and l.holder_id = v_user
  ) then
    raise exception 'collab_not_holder';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Byline and feeds show co-authors only
-- ---------------------------------------------------------------------------
create or replace function private.post_authors(p_post_ids uuid[])
returns table (
  post_id uuid,
  username text,
  display_name text,
  avatar_url text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select pc.post_id, pr.username, pr.display_name, pr.avatar_url, pc.accepted_at
  from public.post_collaborators pc
  join public.posts p on p.id = pc.post_id and p.status = 'published'
  join public.profiles pr on pr.id = pc.user_id
  where pc.status = 'accepted'
    and pc.role = 'coauthor'
    and pr.username is not null
    and cardinality(p_post_ids) <= 100
    and pc.post_id = any (p_post_ids)
  order by pc.post_id, pc.accepted_at;
$$;

create or replace function private.published_post_ids(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_exclude_id uuid,
  p_limit integer
)
returns table (post_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.posts p
  where p.status = 'published'
    and p.published_at is not null
    and (
      p_author_ids is null
      or p.author_id = any (p_author_ids)
      or exists (
        select 1
        from public.post_collaborators pc
        where pc.post_id = p.id
          and pc.status = 'accepted'
          and pc.role = 'coauthor'
          and pc.user_id = any (p_author_ids)
      )
    )
    and (p_exclude_id is null or p.id <> p_exclude_id)
    and (p_after_at is null or (p.published_at, p.id) < (p_after_at, p_after_id))
  order by p.published_at desc, p.id desc
  limit least(greatest(p_limit, 1), 200);
$$;

create or replace function private.following_feed(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (post_id uuid, event_at timestamptz, reposter_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with originals as (
    select p.id as post_id, p.published_at as at
    from public.posts p
    where p.status = 'published'
      and p.published_at is not null
      and (
        p.author_id = any (p_author_ids)
        or exists (
          select 1
          from public.post_collaborators pc
          where pc.post_id = p.id
            and pc.status = 'accepted'
            and pc.role = 'coauthor'
            and pc.user_id = any (p_author_ids)
        )
      )
  ),
  latest_repost as (
    select distinct on (r.post_id) r.post_id, r.created_at as at, r.user_id
    from public.reposts r
    join public.posts p
      on p.id = r.post_id
     and p.status = 'published'
     and p.published_at is not null
    where r.user_id = any (p_author_ids)
    order by r.post_id, r.created_at desc
  ),
  merged as (
    select
      coalesce(o.post_id, lr.post_id) as post_id,
      case when lr.at is not null and (o.at is null or lr.at > o.at)
           then lr.at else o.at end as event_at,
      case when lr.at is not null and (o.at is null or lr.at > o.at)
           then lr.user_id else null end as reposter_id
    from originals o
    full join latest_repost lr on lr.post_id = o.post_id
  )
  select m.post_id, m.event_at, m.reposter_id
  from merged m
  where p_after_at is null
     or (m.event_at, m.post_id) < (p_after_at, p_after_id)
  order by m.event_at desc, m.post_id desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- 6. Like, comment and repost notifications go to co-authors only
-- ---------------------------------------------------------------------------
create or replace function private.notify_post_team(
  p_post_id uuid,
  p_actor uuid,
  p_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, post_id)
  select t.user_id, p_actor, p_type, p_post_id
  from (
    select p.author_id as user_id
    from public.posts p
    where p.id = p_post_id
    union
    select c.user_id
    from public.post_collaborators c
    where c.post_id = p_post_id
      and c.status = 'accepted'
      and c.role = 'coauthor'
  ) t
  where t.user_id <> p_actor
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. "Edited by": public data of accepted editors of PUBLISHED posts
-- ---------------------------------------------------------------------------
create function private.post_editors(p_post_ids uuid[])
returns table (
  post_id uuid,
  username text,
  display_name text,
  avatar_url text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select pc.post_id, pr.username, pr.display_name, pr.avatar_url, pc.accepted_at
  from public.post_collaborators pc
  join public.posts p on p.id = pc.post_id and p.status = 'published'
  join public.profiles pr on pr.id = pc.user_id
  where pc.status = 'accepted'
    and pc.role = 'editor'
    and pc.show_credit
    and pr.username is not null
    and cardinality(p_post_ids) <= 100
    and pc.post_id = any (p_post_ids)
  order by pc.post_id, pc.accepted_at;
$$;

create function public.get_post_editors(p_post_ids uuid[])
returns table (
  post_id uuid,
  username text,
  display_name text,
  avatar_url text,
  accepted_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.post_editors(p_post_ids);
$$;

revoke all on function private.post_editors(uuid[]) from public;
revoke all on function public.get_post_editors(uuid[]) from public;
grant execute on function private.post_editors(uuid[]) to anon, authenticated;
grant execute on function public.get_post_editors(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. My pending invitations now say the role and whether the credit shows.
-- The return type changes, so the old functions are dropped first.
-- ---------------------------------------------------------------------------
drop function public.list_my_invites();
drop function private.list_my_invites();

create function private.list_my_invites()
returns table (
  post_id uuid,
  post_title text,
  owner_display_name text,
  owner_username text,
  created_at timestamptz,
  invite_role text,
  show_credit boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.post_id, p.title, pr.display_name, pr.username, c.created_at,
         c.role, c.show_credit
  from public.post_collaborators c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = p.author_id
  where c.user_id = (select auth.uid())
    and c.status = 'pending'
  order by c.created_at desc;
$$;

create function public.list_my_invites()
returns table (
  post_id uuid,
  post_title text,
  owner_display_name text,
  owner_username text,
  created_at timestamptz,
  invite_role text,
  show_credit boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.post_id, i.post_title, i.owner_display_name, i.owner_username,
         i.created_at, i.invite_role, i.show_credit
  from private.list_my_invites() i;
$$;

revoke all on function private.list_my_invites() from public, anon;
grant execute on function private.list_my_invites() to authenticated;
revoke all on function public.list_my_invites() from public, anon;
grant execute on function public.list_my_invites() to authenticated;

commit;