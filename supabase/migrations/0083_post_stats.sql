-- 0083_post_stats.sql
-- Author insights, part 1: a daily counter of views and reads per story.
-- Counts only: no cookie, no IP, no user agent, no reader id. The day is the
-- Asia/Jakarta day. Nobody reads the table directly (no grants, no policies);
-- the author reads through public.get_author_insights (migration 0084).

begin;

create table public.post_stats_daily (
  post_id uuid not null references public.posts (id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  reads integer not null default 0 check (reads >= 0),
  primary key (post_id, day)
);

alter table public.post_stats_daily enable row level security;
revoke all on public.post_stats_daily from anon, authenticated;

grant usage on schema private to anon;

-- Records one view or one read. Returns silently (no error text) for an
-- unknown kind, a story that is not published, and the owner or an accepted
-- co-author of the story. auth.uid() is null for a signed-out visitor.
create function private.record_post_event(p_post_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if p_kind is null or p_kind not in ('view', 'read') then
    return;
  end if;

  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.status = 'published'
  ) then
    return;
  end if;

  if v_uid is not null and (
    exists (
      select 1 from public.posts p
      where p.id = p_post_id and p.author_id = v_uid
    )
    or exists (
      select 1 from public.post_collaborators c
      where c.post_id = p_post_id and c.user_id = v_uid and c.status = 'accepted'
    )
  ) then
    return;
  end if;

  insert into public.post_stats_daily as s (post_id, day, views, reads)
  values (
    p_post_id,
    v_day,
    case when p_kind = 'view' then 1 else 0 end,
    case when p_kind = 'read' then 1 else 0 end
  )
  on conflict (post_id, day) do update
    set views = s.views + excluded.views,
        reads = s.reads + excluded.reads;
end;
$fn$;

revoke all on function private.record_post_event(uuid, text) from public;
grant execute on function private.record_post_event(uuid, text) to anon, authenticated;

create function public.record_post_event(p_post_id uuid, p_kind text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.record_post_event(p_post_id, p_kind);
$$;

revoke all on function public.record_post_event(uuid, text) from public;
grant execute on function public.record_post_event(uuid, text) to anon, authenticated;

commit;