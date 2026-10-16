-- 0025_post_credits.sql
-- Run after 0024.
-- Credits: people who contributed to a post without writing it.
-- People with an account must accept; people without one are credited by name.

begin;

create table public.post_credits (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  -- Exactly one of user_id (has an account) and name (no account).
  user_id uuid references public.profiles (id) on delete cascade,
  name text,
  link text,
  role text not null,
  role_other text,
  -- Filled by the trigger below; the app never sends these.
  status text not null default 'pending',
  invited_by uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint post_credits_one_target check ((user_id is null) <> (name is null)),
  constraint post_credits_name_length
    check (name is null or char_length(btrim(name)) between 1 and 80),
  constraint post_credits_link_valid
    check (link is null or (user_id is null and link ~ '^https?://' and char_length(link) <= 300)),
  constraint post_credits_role_valid
    check (role in ('editor', 'research', 'illustration', 'photography',
                    'translation', 'interview', 'data', 'review', 'thanks', 'other')),
  constraint post_credits_role_other_matches
    check ((role = 'other') = (role_other is not null)),
  constraint post_credits_role_other_length
    check (role_other is null or char_length(btrim(role_other)) between 1 and 40),
  constraint post_credits_status_valid check (status in ('pending', 'accepted')),
  constraint post_credits_accepted_at_matches
    check ((status = 'accepted') = (accepted_at is not null))
);

-- One row per person per post, and no same name twice.
create unique index post_credits_user_unique
  on public.post_credits (post_id, user_id) where user_id is not null;
create unique index post_credits_name_unique
  on public.post_credits (post_id, lower(btrim(name))) where name is not null;
create index post_credits_post_idx on public.post_credits (post_id, status);
create index post_credits_user_idx on public.post_credits (user_id, status)
  where user_id is not null;

alter table public.post_credits enable row level security;

-- Start from nothing. No UPDATE right: accepting goes through respond_credit.
-- INSERT is per column, so status and accepted_at can never come from a client.
revoke all on public.post_credits from anon, authenticated;
grant select, delete on public.post_credits to authenticated;
grant insert (post_id, user_id, name, link, role, role_other)
  on public.post_credits to authenticated;

-- ---------- limits and status (trigger, definer) ----------
-- The messages are codes the app maps to plain English.
create function private.check_credit_insert()
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
  -- Lock the post row so two inserts at the same moment cannot both pass the cap.
  select p.author_id into v_owner
  from public.posts p
  where p.id = new.post_id
  for update;

  if not found then
    raise exception 'credit_post_not_found';
  end if;

  select count(*) into v_count
  from public.post_credits c
  where c.post_id = new.post_id;

  if v_count >= 20 then
    raise exception 'credit_post_limit';
  end if;

  -- Someone without an account cannot accept: shown at once.
  if new.user_id is null then
    new.status := 'accepted';
    new.accepted_at := now();
    return new;
  end if;

  new.status := 'pending';
  new.accepted_at := null;

  if new.user_id = v_owner then
    raise exception 'credit_self';
  end if;

  select pr.username into v_username
  from public.profiles pr
  where pr.id = new.user_id;

  if v_username is null then
    raise exception 'credit_not_onboarded';
  end if;

  -- Co-authors are already in the byline.
  if exists (
    select 1 from public.post_collaborators c
    where c.post_id = new.post_id and c.user_id = new.user_id
  ) then
    raise exception 'credit_is_coauthor';
  end if;

  -- Anti-spam: at most 20 pending credit invitations received per person.
  perform pg_advisory_xact_lock(
    hashtextextended('credit_invitee:' || new.user_id::text, 0)
  );

  select count(*) into v_count
  from public.post_credits c
  where c.user_id = new.user_id and c.status = 'pending';

  if v_count >= 20 then
    raise exception 'credit_invitee_limit';
  end if;

  return new;
end;
$$;

revoke all on function private.check_credit_insert() from public, anon, authenticated;

create trigger post_credits_check_insert
  before insert on public.post_credits
  for each row execute function private.check_credit_insert();

-- ---------- RLS policies ----------
-- Read: the post owner sees every row of the post; a person sees their own row.
create policy "post_credits_select"
  on public.post_credits
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_post_owner(post_id)
  );

-- Credit someone: only the post owner, always as themselves.
create policy "post_credits_insert_owner"
  on public.post_credits
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and private.is_post_owner(post_id)
  );

-- Remove: the post owner, or the credited person (resign).
create policy "post_credits_delete"
  on public.post_credits
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_post_owner(post_id)
  );

-- ---------- accept / decline ----------
create function private.respond_credit(p_credit_id uuid, p_accept boolean)
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
    update public.post_credits c
       set status = 'accepted', accepted_at = now()
     where c.id = p_credit_id
       and c.user_id = v_user
       and c.status = 'pending';
  else
    delete from public.post_credits c
     where c.id = p_credit_id
       and c.user_id = v_user
       and c.status = 'pending';
  end if;

  if not found then
    raise exception 'credit_not_found';
  end if;
end;
$$;

create function public.respond_credit(p_credit_id uuid, p_accept boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.respond_credit(p_credit_id, p_accept);
$$;

revoke all on function private.respond_credit(uuid, boolean) from public, anon;
grant execute on function private.respond_credit(uuid, boolean) to authenticated;
revoke all on function public.respond_credit(uuid, boolean) from public, anon;
grant execute on function public.respond_credit(uuid, boolean) to authenticated;

-- ---------- my pending credit invitations ----------
-- Only the title and who invited: never the body of a draft.
create function private.list_my_credit_invites()
returns table (
  credit_id uuid,
  post_id uuid,
  post_title text,
  owner_display_name text,
  owner_username text,
  role text,
  role_other text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.post_id, p.title, pr.display_name, pr.username,
         c.role, c.role_other, c.created_at
  from public.post_credits c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = p.author_id
  where c.user_id = (select auth.uid())
    and c.status = 'pending'
  order by c.created_at desc;
$$;

create function public.list_my_credit_invites()
returns table (
  credit_id uuid,
  post_id uuid,
  post_title text,
  owner_display_name text,
  owner_username text,
  role text,
  role_other text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.credit_id, i.post_id, i.post_title, i.owner_display_name,
         i.owner_username, i.role, i.role_other, i.created_at
  from private.list_my_credit_invites() i;
$$;

revoke all on function private.list_my_credit_invites() from public, anon;
grant execute on function private.list_my_credit_invites() to authenticated;
revoke all on function public.list_my_credit_invites() from public, anon;
grant execute on function public.list_my_credit_invites() to authenticated;

-- ---------- public read: accepted credits of a PUBLISHED post ----------
create function private.list_public_credits(p_post_id uuid)
returns table (
  credit_id uuid,
  role text,
  role_other text,
  username text,
  display_name text,
  avatar_url text,
  name text,
  link text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.role, c.role_other, pr.username, pr.display_name,
         pr.avatar_url, c.name, c.link
  from public.post_credits c
  join public.posts p on p.id = c.post_id and p.status = 'published'
  left join public.profiles pr on pr.id = c.user_id
  where c.post_id = p_post_id
    and c.status = 'accepted'
    and (c.user_id is null or pr.username is not null)
  order by c.created_at, c.id;
$$;

create function public.get_post_credits(p_post_id uuid)
returns table (
  credit_id uuid,
  role text,
  role_other text,
  username text,
  display_name text,
  avatar_url text,
  name text,
  link text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_public_credits(p_post_id);
$$;

revoke all on function private.list_public_credits(uuid) from public;
revoke all on function public.get_post_credits(uuid) from public;
grant execute on function private.list_public_credits(uuid) to anon, authenticated;
grant execute on function public.get_post_credits(uuid) to anon, authenticated;

-- ---------- notification type "credit" ----------
alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications drop constraint notifications_post_matches_type;
alter table public.notifications
  add constraint notifications_type_valid
    check (type in ('follow', 'like', 'comment', 'reply', 'repost', 'credit'));
alter table public.notifications
  add constraint notifications_post_matches_type
    check ((type in ('like', 'comment', 'reply', 'repost', 'credit')) = (post_id is not null));

create function private.notify_on_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only people with an account get a bell notification.
  if new.user_id is not null then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    values (new.user_id, new.invited_by, 'credit', new.post_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.notify_on_credit() from public;

create trigger notify_on_credit
  after insert on public.post_credits
  for each row execute function private.notify_on_credit();

-- ---------- rate limit rules (migration 0007) ----------
insert into private.rate_limit_rules (action, max_hits, window_seconds) values
  ('credit_invite',  20, 3600),   -- addCredit
  ('credit_respond', 30,  600)    -- respondCredit, removeCredit
on conflict (action) do nothing;

commit;