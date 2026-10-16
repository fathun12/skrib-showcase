-- 0056: Notes functions. Counts, the Following list, the report function that
-- writes the evidence snapshot, and hiding a reply by the parent's author.

begin;

-- Counts: security invoker, so RLS decides what is counted.
-- Notes without likes or replies are absent from the result (treat as 0).
create function public.get_note_like_counts(note_ids uuid[])
returns table (note_id uuid, like_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.note_id, count(*)::bigint as like_count
  from public.note_likes l
  where l.note_id = any (note_ids)
  group by l.note_id;
$$;

create function public.get_note_reply_counts(note_ids uuid[])
returns table (note_id uuid, reply_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.reply_to_id, count(*)::bigint as reply_count
  from public.notes n
  where n.reply_to_id = any (note_ids)
    and n.status = 'published'
  group by n.reply_to_id;
$$;

-- Following list: top-level published notes by the given authors, keyset order
-- (created_at, id) like get_following_feed (0024).
create function public.get_following_notes(
  p_author_ids uuid[],
  p_after_at timestamptz,
  p_after_id uuid,
  p_limit integer
)
returns table (note_id uuid, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.id, n.created_at
  from public.notes n
  where n.status = 'published'
    and n.reply_to_id is null
    and n.author_id = any (p_author_ids)
    and (
      p_after_at is null
      or (n.created_at, n.id) < (p_after_at, p_after_id)
    )
  order by n.created_at desc, n.id desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- Report: the DATABASE copies the evidence (text, author, time, parent) into
-- the report row. The browser never writes the snapshot. A duplicate report by
-- the same user returns null.
create function private.report_note(
  p_note_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_details text := nullif(btrim(p_details), '');
  v_note record;
  v_parent jsonb;
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

  select n.id, n.author_id, n.body, n.created_at, n.reply_to_id, a.username
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
       'parent', v_parent
     ),
     p_reason, v_details)
  on conflict (reporter_id, note_id) do nothing
  returning id into v_id;

  return v_id;
end;
$function$;

create function public.report_note(
  p_note_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.report_note(p_note_id, p_reason, p_details);
$$;

-- Hide (or show again) a reply under MY note. Only published <-> hidden_by_author;
-- an admin 'hidden' is never touched. The row and its text stay.
create function private.hide_note_reply(p_note_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if private.is_suspended() then
    raise exception 'account_suspended' using errcode = '42501';
  end if;

  update public.notes n
     set status = case when p_hidden then 'hidden_by_author' else 'published' end
    from public.notes parent
   where n.id = p_note_id
     and parent.id = n.reply_to_id
     and parent.author_id = v_user
     and n.author_id <> v_user
     and n.status = case when p_hidden then 'published' else 'hidden_by_author' end;

  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$function$;

create function public.hide_note_reply(p_note_id uuid, p_hidden boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.hide_note_reply(p_note_id, p_hidden);
$$;

revoke all on function public.get_note_like_counts(uuid[]) from public;
revoke all on function public.get_note_reply_counts(uuid[]) from public;
revoke all on function public.get_following_notes(uuid[], timestamptz, uuid, integer) from public;
revoke all on function private.report_note(uuid, text, text) from public, anon;
revoke all on function public.report_note(uuid, text, text) from public, anon;
revoke all on function private.hide_note_reply(uuid, boolean) from public, anon;
revoke all on function public.hide_note_reply(uuid, boolean) from public, anon;

grant execute on function public.get_note_like_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_note_reply_counts(uuid[]) to anon, authenticated;
grant execute on function public.get_following_notes(uuid[], timestamptz, uuid, integer) to authenticated;
grant execute on function private.report_note(uuid, text, text) to authenticated;
grant execute on function public.report_note(uuid, text, text) to authenticated;
grant execute on function private.hide_note_reply(uuid, boolean) to authenticated;
grant execute on function public.hide_note_reply(uuid, boolean) to authenticated;

commit;