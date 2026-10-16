-- 0009_collaborators.sql
-- Run after 0008.
-- Co-authoring, part 1 (COLLAB_SPEC step C1): who is invited to which post.
-- Edit locks come later (step C5). Co-authors get NO update policy on posts:
-- they will write only through a function (step C5).

begin;

create table public.post_collaborators (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Filled by the database from the session; the app never sends it.
  invited_by uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (post_id, user_id),
  constraint post_collaborators_status_valid
    check (status in ('pending', 'accepted')),
  constraint post_collaborators_accepted_at_matches
    check ((status = 'accepted') = (accepted_at is not null))
);

create index post_collaborators_user_idx
  on public.post_collaborators (user_id, status);

alter table public.post_collaborators enable row level security;

-- Decision 22: start from nothing, then grant exactly what is needed.
-- No UPDATE right at all: accepting goes through respond_invite.
-- INSERT is per column, so status and accepted_at can never be set by a client.
revoke all on public.post_collaborators from anon, authenticated;
grant select, delete on public.post_collaborators to authenticated;
grant insert (post_id, user_id) on public.post_collaborators to authenticated;

-- ---------- helpers for the policies (definer, schema private) ----------
-- A policy on posts that reads post_collaborators, and a policy on
-- post_collaborators that reads posts, would call each other forever
-- ("infinite recursion detected in policy"). These two functions read the
-- tables without going through RLS, so the loop is cut.
create function private.is_post_owner(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.author_id = (select auth.uid())
  );
$$;

create function private.is_accepted_coauthor(p_post_id uuid)
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

revoke all on function private.is_post_owner(uuid) from public, anon;
grant execute on function private.is_post_owner(uuid) to authenticated;
revoke all on function private.is_accepted_coauthor(uuid) from public, anon;
grant execute on function private.is_accepted_coauthor(uuid) to authenticated;

-- ---------- limits (trigger, definer) ----------
-- The messages are codes the app maps to plain English.
create function private.check_collaborator_insert()
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
  -- Lock the post row, so two invites sent at the same moment cannot both
  -- pass the cap of 3.
  select p.author_id into v_owner
  from public.posts p
  where p.id = new.post_id
  for update;

  if not found then
    raise exception 'collab_post_not_found';
  end if;

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

revoke all on function private.check_collaborator_insert() from public, anon, authenticated;

create trigger post_collaborators_check_insert
  before insert on public.post_collaborators
  for each row execute function private.check_collaborator_insert();

-- ---------- RLS policies ----------
-- Read: the post owner sees every row of the post; a person sees their own row.
create policy "post_collaborators_select"
  on public.post_collaborators
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_post_owner(post_id)
  );

-- Invite: only the post owner, always as pending, always as themselves.
create policy "post_collaborators_insert_owner"
  on public.post_collaborators
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and private.is_post_owner(post_id)
  );

-- Leave, decline or remove: the person themselves or the post owner.
create policy "post_collaborators_delete"
  on public.post_collaborators
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_post_owner(post_id)
  );

-- Accepted co-authors may READ the post (draft or published). Nothing else:
-- there is deliberately no update policy for them.
create policy "co-authors read shared posts"
  on public.posts
  for select
  to authenticated
  using (private.is_accepted_coauthor(id));

-- ---------- accept / decline ----------
create function private.respond_invite(p_post_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if p_accept then
    update public.post_collaborators c
       set status = 'accepted', accepted_at = now()
     where c.post_id = p_post_id
       and c.user_id = v_user
       and c.status = 'pending';
  else
    delete from public.post_collaborators c
     where c.post_id = p_post_id
       and c.user_id = v_user
       and c.status = 'pending';
  end if;

  if not found then
    raise exception 'collab_invite_not_found';
  end if;
end;
$$;

create function public.respond_invite(p_post_id uuid, p_accept boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.respond_invite(p_post_id, p_accept);
$$;

-- ---------- my pending invitations ----------
-- A pending invitee may see only the title and who invited them,
-- never the body of the draft.
create function private.list_my_invites()
returns table (
  post_id uuid,
  post_title text,
  owner_display_name text,
  owner_username text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.post_id, p.title, pr.display_name, pr.username, c.created_at
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
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.post_id, i.post_title, i.owner_display_name, i.owner_username, i.created_at
  from private.list_my_invites() i;
$$;

revoke all on function private.respond_invite(uuid, boolean) from public, anon;
grant execute on function private.respond_invite(uuid, boolean) to authenticated;
revoke all on function public.respond_invite(uuid, boolean) from public, anon;
grant execute on function public.respond_invite(uuid, boolean) to authenticated;

revoke all on function private.list_my_invites() from public, anon;
grant execute on function private.list_my_invites() to authenticated;
revoke all on function public.list_my_invites() from public, anon;
grant execute on function public.list_my_invites() to authenticated;

-- ---------- rate limit rules (migration 0007) ----------
insert into private.rate_limit_rules (action, max_hits, window_seconds) values
  ('collab_invite',  20, 3600),   -- inviteCollaborator
  ('collab_respond', 30,  600)    -- respondInvite, leavePost, removeCollaborator
on conflict (action) do nothing;

commit;