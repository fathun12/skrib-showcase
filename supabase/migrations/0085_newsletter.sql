-- 0085_newsletter.sql
-- Newsletter: caps, profile flag, three tables, functions.
-- Tables have RLS on and NO grants for anon or authenticated.
begin;

-- 1. Daily caps (counted in recipients / confirmation mails).
insert into private.email_rules (kind, daily_cap)
values ('newsletter', 60), ('newsletter_confirm', 15)
on conflict (kind) do nothing;

-- 2. Author setting.
alter table public.profiles
  add column newsletter_enabled boolean not null default true;
grant select (newsletter_enabled) on public.profiles to anon, authenticated;
grant update (newsletter_enabled) on public.profiles to authenticated;

-- 3. Tables.
create table public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending',
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  last_confirm_sent_at timestamptz,
  unsubscribed_at timestamptz,
  constraint newsletter_subscriptions_status_valid
    check (status in ('pending', 'active', 'unsubscribed')),
  constraint newsletter_subscriptions_email_valid
    check (
      email = lower(email)
      and length(email) between 5 and 254
      and position('@' in email) > 1
      and length(email) - length(replace(email, '@', '')) = 1
      and email !~ '[[:space:]]'
    ),
  unique (author_id, email)
);
create index newsletter_subscriptions_author_status_idx
  on public.newsletter_subscriptions (author_id, status);
create index newsletter_subscriptions_user_idx
  on public.newsletter_subscriptions (user_id) where user_id is not null;

create table public.newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  constraint newsletter_sends_status_valid
    check (status in ('queued', 'sending', 'done', 'skipped'))
);

create table public.newsletter_deliveries (
  send_id uuid not null references public.newsletter_sends(id) on delete cascade,
  subscription_id uuid not null references public.newsletter_subscriptions(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (send_id, subscription_id)
);

alter table public.newsletter_subscriptions enable row level security;
alter table public.newsletter_sends enable row level security;
alter table public.newsletter_deliveries enable row level security;
revoke all on public.newsletter_subscriptions from public, anon, authenticated;
revoke all on public.newsletter_sends from public, anon, authenticated;
revoke all on public.newsletter_deliveries from public, anon, authenticated;

-- 4. Reserve slots from a daily cap (same idea as admin_prepare_email,
--    counted per recipient). Internal: nobody calls it from the API.
create function private.reserve_email_slots(p_kind text, p_count integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cap integer;
  v_used integer;
  v_grant integer;
begin
  if p_kind not in ('newsletter', 'newsletter_confirm')
     or p_count is null or p_count <= 0 then
    return 0;
  end if;

  select r.daily_cap into v_cap
  from private.email_rules r
  where r.kind = p_kind;
  if not found then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext('email_log:' || p_kind));

  delete from private.email_log
  where created_at < now() - interval '2 days';

  select count(*)::integer into v_used
  from private.email_log l
  where l.kind = p_kind
    and l.created_at > now() - interval '24 hours';

  v_grant := least(p_count, greatest(v_cap - v_used, 0));
  if v_grant > 0 then
    insert into private.email_log (kind)
    select p_kind from generate_series(1, v_grant);
  end if;
  return v_grant;
end;
$$;

-- 5. Subscribe (service role only: the confirm token never reaches the browser).
create function private.request_newsletter_subscription(
  p_author uuid, p_email text, p_user uuid
)
returns table (o_outcome text, o_token uuid, o_email text, o_author_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_email text;
  v_name text;
  v_token uuid;
  v_row public.newsletter_subscriptions%rowtype;
begin
  select pr.display_name into v_name
  from public.profiles pr
  where pr.id = p_author and pr.username is not null and pr.newsletter_enabled;
  if v_name is null or p_author = p_user then
    return query select 'unavailable'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if p_user is not null then
    select lower(u.email) into v_email
    from auth.users u
    where u.id = p_user and u.email_confirmed_at is not null;
  else
    v_email := lower(btrim(coalesce(p_email, '')));
  end if;

  if v_email is null
     or length(v_email) not between 5 and 254
     or position('@' in v_email) < 2
     or length(v_email) - length(replace(v_email, '@', '')) <> 1
     or v_email ~ '[[:space:]]' then
    return query select 'invalid_email'::text, null::uuid, null::text, null::text;
    return;
  end if;

  insert into public.newsletter_subscriptions
    (author_id, email, user_id, status, confirmed_at)
  values (
    p_author, v_email, p_user,
    case when p_user is null then 'pending' else 'active' end,
    case when p_user is null then null else now() end
  )
  on conflict (author_id, email) do nothing;

  select * into v_row
  from public.newsletter_subscriptions s
  where s.author_id = p_author and s.email = v_email
  for update;

  -- Signed in: one click, no mail.
  if p_user is not null then
    if v_row.status <> 'active' or v_row.user_id is distinct from p_user then
      update public.newsletter_subscriptions s
      set confirmed_at = case when s.status <> 'active' then now() else s.confirmed_at end,
          status = 'active',
          unsubscribed_at = null,
          user_id = p_user
      where s.id = v_row.id;
    end if;
    return query select 'subscribed'::text, null::uuid, null::text, null::text;
    return;
  end if;

  -- Guest: neutral answer when already active, or a mail went out in the
  -- last 24 hours, or the daily confirmation cap is used up.
  if v_row.status = 'active'
     or (v_row.last_confirm_sent_at is not null
         and v_row.last_confirm_sent_at > now() - interval '24 hours')
     or private.reserve_email_slots('newsletter_confirm', 1) < 1 then
    return query select 'wait'::text, null::uuid, null::text, null::text;
    return;
  end if;

  update public.newsletter_subscriptions s
  set status = 'pending',
      token = gen_random_uuid(),
      last_confirm_sent_at = now(),
      unsubscribed_at = null
  where s.id = v_row.id
  returning s.token into v_token;

  return query select 'send_confirmation'::text, v_token, v_row.email, v_name;
end;
$$;

create function public.request_newsletter_subscription(
  p_author uuid, p_email text, p_user uuid
)
returns table (o_outcome text, o_token uuid, o_email text, o_author_name text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.request_newsletter_subscription(p_author, p_email, p_user);
$$;

-- 6. Confirm, unsubscribe, token info (the token is the credential).
create function private.confirm_newsletter(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id uuid;
begin
  update public.newsletter_subscriptions s
  set status = 'active', confirmed_at = now(), unsubscribed_at = null
  where s.token = p_token
    and s.status = 'pending'
    and s.last_confirm_sent_at > now() - interval '7 days'
  returning s.id into v_id;
  if v_id is not null then
    return 'confirmed';
  end if;
  -- A mail scanner may have opened the link before: stay calm.
  if exists (
    select 1 from public.newsletter_subscriptions s
    where s.token = p_token and s.status = 'active'
  ) then
    return 'confirmed';
  end if;
  return 'invalid';
end;
$$;

create function public.confirm_newsletter(p_token uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_newsletter(p_token);
$$;

create function private.unsubscribe_newsletter(p_token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_id uuid;
begin
  update public.newsletter_subscriptions s
  set status = 'unsubscribed', unsubscribed_at = now()
  where s.token = p_token and s.status <> 'unsubscribed'
  returning s.id into v_id;
  if v_id is not null then
    return 'unsubscribed';
  end if;
  if exists (
    select 1 from public.newsletter_subscriptions s where s.token = p_token
  ) then
    return 'unsubscribed';
  end if;
  return 'invalid';
end;
$$;

create function public.unsubscribe_newsletter(p_token uuid)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.unsubscribe_newsletter(p_token);
$$;

create function private.newsletter_token_info(p_token uuid)
returns table (o_author_name text, o_author_username text, o_status text)
language sql
security definer
stable
set search_path = ''
as $$
  select pr.display_name, pr.username, s.status
  from public.newsletter_subscriptions s
  join public.profiles pr on pr.id = s.author_id
  where s.token = p_token;
$$;

create function public.get_newsletter_token_info(p_token uuid)
returns table (o_author_name text, o_author_username text, o_status text)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.newsletter_token_info(p_token);
$$;

-- 7. Count of active subscribers for the signed-in author (no user id parameter).
create function private.my_newsletter_subscriber_count(p_user uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.newsletter_subscriptions s
  where s.author_id = p_user and s.status = 'active';
$$;

create function public.my_newsletter_subscriber_count()
returns integer
language sql
security invoker
stable
set search_path = ''
as $$
  select private.my_newsletter_subscriber_count(auth.uid());
$$;

-- 8. Sending (service role only).
create function private.queue_newsletter_send(p_post uuid, p_skip boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_author uuid;
  v_id uuid;
begin
  select p.author_id into v_author
  from public.posts p
  where p.id = p_post and p.status = 'published';
  if v_author is null then
    return null;
  end if;
  insert into public.newsletter_sends (post_id, author_id, status)
  values (
    p_post, v_author,
    case when p_skip
           or not exists (
             select 1 from public.profiles pr
             where pr.id = v_author and pr.newsletter_enabled
           )
         then 'skipped' else 'queued' end
  )
  on conflict (post_id) do nothing
  returning id into v_id;
  -- NULL when this story already had its one send (or its one skip).
  return v_id;
end;
$$;

create function public.queue_newsletter_send(p_post uuid, p_skip boolean)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.queue_newsletter_send(p_post, p_skip);
$$;

create function private.next_newsletter_batch(p_send uuid, p_limit integer)
returns table (o_subscription_id uuid, o_email text, o_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_send public.newsletter_sends%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 0), 0), 200);
  v_candidates integer;
  v_granted integer;
begin
  if v_limit = 0 then
    return;
  end if;

  -- The lock lasts for this transaction: the cron job and after() cannot
  -- pick the same people at the same time.
  select * into v_send
  from public.newsletter_sends s
  where s.id = p_send
  for update;
  if not found or v_send.status in ('done', 'skipped') then
    return;
  end if;

  if v_send.created_at < now() - interval '7 days'
     or not exists (
       select 1 from public.posts p
       where p.id = v_send.post_id and p.status = 'published'
     )
     or not exists (
       select 1 from public.profiles pr
       where pr.id = v_send.author_id and pr.newsletter_enabled
     ) then
    update public.newsletter_sends s set status = 'skipped' where s.id = p_send;
    return;
  end if;

  select count(*)::integer into v_candidates
  from (
    select 1
    from public.newsletter_subscriptions s
    where s.author_id = v_send.author_id
      and s.status = 'active'
      and not exists (
        select 1 from public.newsletter_deliveries d
        where d.send_id = p_send and d.subscription_id = s.id
      )
    limit v_limit
  ) c;

  if v_candidates = 0 then
    update public.newsletter_sends s set status = 'done' where s.id = p_send;
    return;
  end if;

  v_granted := private.reserve_email_slots('newsletter', v_candidates);
  if v_granted = 0 then
    return;  -- daily cap used up: the cron job continues tomorrow
  end if;

  update public.newsletter_sends s set status = 'sending' where s.id = p_send;

  return query
  with picked as (
    select s.id, s.email, s.token
    from public.newsletter_subscriptions s
    where s.author_id = v_send.author_id
      and s.status = 'active'
      and not exists (
        select 1 from public.newsletter_deliveries d
        where d.send_id = p_send and d.subscription_id = s.id
      )
    order by s.created_at, s.id
    limit v_granted
    for update of s skip locked
  ),
  claimed as (
    insert into public.newsletter_deliveries (send_id, subscription_id)
    select p_send, pk.id from picked pk
    returning subscription_id
  )
  select pk.id, pk.email, pk.token
  from picked pk
  join claimed cl on cl.subscription_id = pk.id;
end;
$$;

create function public.next_newsletter_batch(p_send uuid, p_limit integer)
returns table (o_subscription_id uuid, o_email text, o_token uuid)
language sql
security invoker
set search_path = ''
as $$
  select * from private.next_newsletter_batch(p_send, p_limit);
$$;

-- A mail that could not be sent is released so a later run tries it again
-- (its slot in the daily cap stays used, on purpose).
create function private.release_newsletter_deliveries(
  p_send uuid, p_subscriptions uuid[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.newsletter_deliveries d
  where d.send_id = p_send and d.subscription_id = any (p_subscriptions);
$$;

create function public.release_newsletter_deliveries(
  p_send uuid, p_subscriptions uuid[]
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.release_newsletter_deliveries(p_send, p_subscriptions);
$$;

-- 9. Who may run what.
grant usage on schema private to anon, authenticated, service_role;

revoke all on function private.reserve_email_slots(text, integer)
  from public, anon, authenticated, service_role;

-- service role only
revoke all on function private.request_newsletter_subscription(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.request_newsletter_subscription(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.request_newsletter_subscription(uuid, text, uuid) to service_role;
grant execute on function public.request_newsletter_subscription(uuid, text, uuid) to service_role;

revoke all on function private.queue_newsletter_send(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.queue_newsletter_send(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function private.queue_newsletter_send(uuid, boolean) to service_role;
grant execute on function public.queue_newsletter_send(uuid, boolean) to service_role;

revoke all on function private.next_newsletter_batch(uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.next_newsletter_batch(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.next_newsletter_batch(uuid, integer) to service_role;
grant execute on function public.next_newsletter_batch(uuid, integer) to service_role;

revoke all on function private.release_newsletter_deliveries(uuid, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.release_newsletter_deliveries(uuid, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function private.release_newsletter_deliveries(uuid, uuid[]) to service_role;
grant execute on function public.release_newsletter_deliveries(uuid, uuid[]) to service_role;

-- visitors and signed-in readers (the token is the credential)
revoke all on function private.confirm_newsletter(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.confirm_newsletter(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.confirm_newsletter(uuid) to anon, authenticated;
grant execute on function public.confirm_newsletter(uuid) to anon, authenticated;

revoke all on function private.unsubscribe_newsletter(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.unsubscribe_newsletter(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.unsubscribe_newsletter(uuid) to anon, authenticated;
grant execute on function public.unsubscribe_newsletter(uuid) to anon, authenticated;

revoke all on function private.newsletter_token_info(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_newsletter_token_info(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.newsletter_token_info(uuid) to anon, authenticated;
grant execute on function public.get_newsletter_token_info(uuid) to anon, authenticated;

-- signed-in author only
revoke all on function private.my_newsletter_subscriber_count(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.my_newsletter_subscriber_count()
  from public, anon, authenticated, service_role;
grant execute on function private.my_newsletter_subscriber_count(uuid) to authenticated;
grant execute on function public.my_newsletter_subscriber_count() to authenticated;

commit;