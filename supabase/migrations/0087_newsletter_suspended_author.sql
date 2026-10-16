-- C3-1: a suspended author sends nothing. Same signature as in 0085, so no drop.
create or replace function private.next_newsletter_batch(p_send uuid, p_limit integer)
 returns table(o_subscription_id uuid, o_email text, o_token uuid)
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
     )
     or exists (
       select 1 from private.suspensions su
       where su.user_id = v_send.author_id
         and su.lifted_at is null
         and (su.expires_at is null or su.expires_at > now())
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
$function$;