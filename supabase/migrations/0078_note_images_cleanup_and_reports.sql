-- 0078: note images in the three image-cleanup functions, in the saved report
-- copy and in the admin list, plus the upload rate limit.
begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('note_image_upload', 30, 3600);

-- Admin sweep: note images are used; so are images named in a report copy that
-- is still kept (open, on legal hold, or decided and not past retain_until).
create or replace function private.list_used_image_urls()
 returns table (url text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;

  return query
  with sources as (
    select p.avatar_url as t
      from public.profiles p
    union all
    select po.cover_image_url
      from public.posts po
    union all
    select po.content::text
      from public.posts po
    union all
    select v.content::text
      from private.post_versions v
    union all
    select s.cover_image_url
      from public.series s
    union all
    select i.url
      from public.note_images i
    union all
    select r.snapshot::text
      from public.note_reports r
     where r.legal_hold
        or r.status = 'open'
        or (r.status = 'resolved'
            and (r.retain_until is null or r.retain_until > now()))
  )
  select distinct m[1]
    from sources s,
         regexp_matches(s.t, 'https://res\.cloudinary\.com/[^"\s\\]+', 'g') as m
   where s.t is not null;
end;
$function$;

-- Account deletion: my note images too, except those named in a report copy
-- that stays (decided or on hold), because that copy is the evidence.
create or replace function private.list_my_image_urls()
 returns table (url text)
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  return query
  with sources as (
    select p.avatar_url as t
      from public.profiles p
     where p.id = v_user
    union all
    select po.cover_image_url
      from public.posts po
     where po.author_id = v_user
    union all
    select po.content::text
      from public.posts po
     where po.author_id = v_user
    union all
    select v.content::text
      from private.post_versions v
      join public.posts po on po.id = v.post_id
     where po.author_id = v_user
    union all
    select s.cover_image_url
      from public.series s
     where s.author_id = v_user
    union all
    select i.url
      from public.note_images i
      join public.notes n on n.id = i.note_id
     where n.author_id = v_user
       and not exists (
         select 1 from public.note_reports r
          where (r.legal_hold or r.status = 'resolved')
            and strpos(r.snapshot::text, i.url) > 0)
  )
  select distinct m[1]
    from sources s,
         regexp_matches(s.t, 'https://res\.cloudinary\.com/[^"\s\\]+', 'g') as m
   where s.t is not null;
end;
$function$;

-- Delete a post or a note: an image is unused only when nothing else names it.
create or replace function private.unused_image_urls(p_urls text[])
 returns table (url text)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if coalesce(array_length(p_urls, 1), 0) > 200 then
    raise exception 'too_many_urls';
  end if;

  return query
  select c.u
  from (select distinct unnest(p_urls) as u) c
  where c.u like 'https://res.cloudinary.com/%'
    and not exists (
      select 1 from public.profiles p where p.avatar_url = c.u)
    and not exists (
      select 1 from public.posts po where po.cover_image_url = c.u)
    and not exists (
      select 1 from public.series s where s.cover_image_url = c.u)
    and not exists (
      select 1 from public.posts po
      where strpos(po.content::text, c.u) > 0)
    and not exists (
      select 1 from private.post_versions v
      where strpos(v.content::text, c.u) > 0)
    and not exists (
      select 1 from public.note_images ni where ni.url = c.u)
    and not exists (
      select 1 from public.note_reports r
      where (r.legal_hold
             or r.status = 'open'
             or (r.status = 'resolved'
                 and (r.retain_until is null or r.retain_until > now())))
        and strpos(r.snapshot::text, c.u) > 0);
end;
$function$;

-- The saved report copy also holds the images of the note (url, alt, size).
create or replace function private.report_note(p_note_id uuid, p_reason text, p_details text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_details text := nullif(btrim(p_details), '');
  v_note record;
  v_parent jsonb;
  v_quote jsonb;
  v_images jsonb;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if p_reason not in ('spam', 'harassment', 'inappropriate', 'illegal', 'other') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if v_details is not null and char_length(v_details) > 500 then
    raise exception 'invalid_details' using errcode = '22023';
  end if;

  select n.id, n.author_id, n.body, n.created_at, n.reply_to_id,
         n.quote_note_id, a.username
    into v_note
    from public.notes n
    join public.profiles a on a.id = n.author_id
   where n.id = p_note_id
     and n.status = 'published';

  if not found then
    raise exception 'note_not_found';
  end if;
  if v_note.author_id = v_user then
    raise exception 'own_note' using errcode = '22023';
  end if;

  select jsonb_build_object(
           'note_id', pn.id,
           'author_id', pn.author_id,
           'author_username', pa.username,
           'text', pn.body,
           'written_at', pn.created_at
         )
    into v_parent
    from public.notes pn
    join public.profiles pa on pa.id = pn.author_id
   where pn.id = v_note.reply_to_id;

  select jsonb_build_object(
           'note_id', qn.id,
           'author_id', qn.author_id,
           'author_username', qa.username,
           'text', qn.body,
           'written_at', qn.created_at
         )
    into v_quote
    from public.notes qn
    join public.profiles qa on qa.id = qn.author_id
   where qn.id = v_note.quote_note_id;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'url', i.url,
               'alt', i.alt,
               'width', i.width,
               'height', i.height
             )
             order by i.position
           ),
           '[]'::jsonb
         )
    into v_images
    from public.note_images i
   where i.note_id = v_note.id;

  insert into public.note_reports
    (reporter_id, note_id, snapshot, reason, details)
  values
    (v_user, v_note.id,
     jsonb_build_object(
       'note_id', v_note.id,
       'author_id', v_note.author_id,
       'author_username', v_note.username,
       'text', v_note.body,
       'written_at', v_note.created_at,
       'parent', v_parent,
       'quote', v_quote,
       'images', v_images
     ),
     p_reason, v_details)
  on conflict (reporter_id, note_id) do nothing
  returning id into v_id;

  return v_id;
end;
$function$;

-- The admin list gets the images of the saved copy (null for older copies).
drop function public.admin_list_note_reports(text, integer, integer);
drop function private.admin_list_note_reports(text, integer, integer);

create function private.admin_list_note_reports(p_status text default 'open', p_limit integer default 50, p_offset integer default 0)
 returns table (
   note_id uuid, note_status text, author_id uuid, author_username text,
   author_display_name text, note_text text, written_at timestamptz,
   parent jsonb, report_count integer, reasons text[],
   latest_report_at timestamptz, reports jsonb, legal_hold boolean,
   retain_until timestamptz, note_quote jsonb, note_images jsonb
 )
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
#variable_conflict use_column
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  return query
  with grouped as (
    select
      r.snapshot->>'note_id' as nid,
      count(*)::integer as cnt,
      array_agg(distinct r.reason order by r.reason) as rsn,
      max(r.created_at) as latest,
      (array_agg(r.snapshot order by r.created_at desc))[1] as snap,
      jsonb_agg(
        jsonb_build_object(
          'reason', r.reason,
          'details', r.details,
          'created_at', r.created_at
        )
        order by r.created_at desc
      ) as rep,
      bool_or(r.legal_hold) as hold,
      max(r.retain_until) as keep
    from public.note_reports r
    where r.status = p_status
    group by r.snapshot->>'note_id'
  )
  select
    g.nid::uuid,
    coalesce(n.status::text, 'deleted'),
    (g.snap->>'author_id')::uuid,
    g.snap->>'author_username',
    a.display_name,
    g.snap->>'text',
    (g.snap->>'written_at')::timestamptz,
    g.snap->'parent',
    g.cnt,
    g.rsn,
    g.latest,
    g.rep,
    g.hold,
    g.keep,
    g.snap->'quote',
    g.snap->'images'
  from grouped g
  left join public.notes n on n.id = g.nid::uuid
  left join public.profiles a on a.id = (g.snap->>'author_id')::uuid
  order by g.latest desc, g.nid
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$function$;

create function public.admin_list_note_reports(p_status text default 'open', p_limit integer default 50, p_offset integer default 0)
 returns table (
   note_id uuid, note_status text, author_id uuid, author_username text,
   author_display_name text, note_text text, written_at timestamptz,
   parent jsonb, report_count integer, reasons text[],
   latest_report_at timestamptz, reports jsonb, legal_hold boolean,
   retain_until timestamptz, note_quote jsonb, note_images jsonb
 )
 language sql
 stable
 set search_path to ''
as $function$
  select * from private.admin_list_note_reports(p_status, p_limit, p_offset);
$function$;

revoke all on function private.admin_list_note_reports(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.admin_list_note_reports(text, integer, integer)
  to authenticated;
revoke all on function public.admin_list_note_reports(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_list_note_reports(text, integer, integer)
  to authenticated;

commit;