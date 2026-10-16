begin;

alter table public.posts
  add column scheduled_for timestamptz,
  add column schedule_email boolean not null default false;

create index posts_scheduled_for_idx
  on public.posts (scheduled_for)
  where scheduled_for is not null;

grant select (scheduled_for, schedule_email) on public.posts to authenticated;

-- A post that leaves "draft" (published by hand, hidden) loses its schedule.
create or replace function private.posts_clear_schedule()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.scheduled_for := null;
  new.schedule_email := false;
  return new;
end;
$function$;

create trigger posts_clear_schedule
before update of status on public.posts
for each row
when (new.status is distinct from 'draft' and new.scheduled_for is not null)
execute function private.posts_clear_schedule();

-- Schedules a draft (p_when set) or cancels the schedule (p_when null).
-- Returns: scheduled, cancelled, not_allowed, no_title, bad_time, bad_slug,
-- slug_taken or invalid.
create or replace function private.schedule_post(
  p_user uuid,
  p_post uuid,
  p_when timestamptz,
  p_slug text,
  p_cover text,
  p_tags text[],
  p_email boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_title text;
  v_status text;
begin
  if p_user is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  select p.title, p.status into v_title, v_status
  from public.posts p
  where p.id = p_post and p.author_id = p_user;
  if not found or v_status <> 'draft' then
    return 'not_allowed';
  end if;

  if p_when is null then
    update public.posts
    set scheduled_for = null, schedule_email = false
    where id = p_post;
    return 'cancelled';
  end if;

  if btrim(coalesce(v_title, '')) = '' then
    return 'no_title';
  end if;
  if p_when < now() + interval '1 minute'
     or p_when > now() + interval '1 year' then
    return 'bad_time';
  end if;
  if p_slug is null or length(p_slug) > 80
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return 'bad_slug';
  end if;

  update public.posts
  set scheduled_for = p_when,
      schedule_email = coalesce(p_email, false),
      slug = p_slug,
      cover_image_url = p_cover,
      tags = coalesce(p_tags, '{}')
  where id = p_post;
  return 'scheduled';
exception
  when unique_violation then return 'slug_taken';
  when check_violation then return 'invalid';
end;
$function$;

create or replace function public.schedule_post(
  p_post uuid,
  p_when timestamptz default null,
  p_slug text default null,
  p_cover text default null,
  p_tags text[] default null,
  p_email boolean default false
)
returns text
language sql
volatile
security invoker
set search_path = ''
as $function$
  select private.schedule_post(auth.uid(), p_post, p_when, p_slug, p_cover, p_tags, p_email);
$function$;

revoke all on function private.schedule_post(uuid, uuid, timestamptz, text, text, text[], boolean) from public, anon, authenticated;
grant execute on function private.schedule_post(uuid, uuid, timestamptz, text, text, text[], boolean) to authenticated;
revoke all on function public.schedule_post(uuid, timestamptz, text, text, text[], boolean) from public, anon, authenticated;
grant execute on function public.schedule_post(uuid, timestamptz, text, text, text[], boolean) to authenticated;

commit;