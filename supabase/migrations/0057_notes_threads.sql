-- 0057: Notes threads. Reserve the username "notes" (the page /notes/<id>
-- would clash with a profile of that name), a rate-limit rule for managing
-- replies, the ancestors of a note, and a list of replies the parent's author
-- hid (RLS shows only published notes and own notes, so he needs a function).

begin;

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('note_manage', 60, 3600);

-- 1. Reserved username: recreate the CHECK with "notes" added.
do $$
declare
  v_name text;
begin
  select conname into v_name
    from pg_constraint
   where conrelid = 'public.profiles'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%signup%';
  if v_name is not null then
    execute format('alter table public.profiles drop constraint %I', v_name);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_username_not_reserved
  check (
    username is null
    or username <> all (array[
      'write', 'me', 'settings', 'login', 'signup', 'register', 'logout',
      'auth', 'api', 'admin', 'about', 'explore', 'tag', 'tags', 'search',
      'onboarding', 'welcome', 'new', 'edit', 'help', 'support', 'privacy',
      'terms', 'feed', 'home', 'rss', 'sitemap', 'robots', 'user', 'users',
      'profile', 'post', 'posts', 'stories', 'null', 'undefined', 'notes'
    ])
  );

-- 2. Ancestors of a note, root first, at most 10 levels. security invoker:
-- RLS decides what the viewer may see, so the chain ends at a hidden parent.
create function public.get_note_ancestors(p_note_id uuid)
returns table (note_id uuid, depth integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive chain as (
    select n.id, n.reply_to_id, 0 as depth
      from public.notes n
     where n.id = p_note_id
    union all
    select p.id, p.reply_to_id, c.depth + 1
      from chain c
      join public.notes p on p.id = c.reply_to_id
     where c.depth < 10
  )
  select chain.id, chain.depth
    from chain
   where chain.depth > 0
   order by chain.depth desc;
$$;

-- 3. Replies the author of the PARENT note hid (so he can show them again).
-- Read only, so no suspension guard is needed.
create function private.list_hidden_replies(p_parent_id uuid)
returns table (id uuid, author_id uuid, body text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  return query
  select n.id, n.author_id, n.body, n.created_at
    from public.notes n
    join public.notes parent on parent.id = n.reply_to_id
   where n.reply_to_id = p_parent_id
     and parent.author_id = auth.uid()
     and n.status = 'hidden_by_author'
   order by n.created_at;
end;
$function$;

create function public.list_hidden_replies(p_parent_id uuid)
returns table (id uuid, author_id uuid, body text, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_hidden_replies(p_parent_id);
$$;

revoke all on function public.get_note_ancestors(uuid) from public;
revoke all on function private.list_hidden_replies(uuid) from public, anon;
revoke all on function public.list_hidden_replies(uuid) from public, anon;
grant execute on function public.get_note_ancestors(uuid) to anon, authenticated;
grant execute on function private.list_hidden_replies(uuid) to authenticated;
grant execute on function public.list_hidden_replies(uuid) to authenticated;

commit;