-- 0065: block and mute for Notes only.
create table public.note_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index note_blocks_blocked_idx on public.note_blocks (blocked_id);

create table public.note_mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
create index note_mutes_muted_idx on public.note_mutes (muted_id);

alter table public.note_blocks enable row level security;
alter table public.note_mutes enable row level security;

revoke all on table public.note_blocks from anon, authenticated;
revoke all on table public.note_mutes from anon, authenticated;
grant select, insert, delete on public.note_blocks to authenticated;
grant select, insert, delete on public.note_mutes to authenticated;

create policy "users read their own note blocks" on public.note_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "users block as themselves" on public.note_blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "users unblock as themselves" on public.note_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));
create policy suspended_no_insert_note_blocks on public.note_blocks
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));

create policy "users read their own note mutes" on public.note_mutes
  for select to authenticated using (muter_id = (select auth.uid()));
create policy "users mute as themselves" on public.note_mutes
  for insert to authenticated with check (muter_id = (select auth.uid()));
create policy "users unmute as themselves" on public.note_mutes
  for delete to authenticated using (muter_id = (select auth.uid()));
create policy suspended_no_insert_note_mutes on public.note_mutes
  as restrictive for insert to authenticated
  with check (not (select private.is_suspended()));

-- True when the author of the note has blocked the user.
create function private.note_blocked_by_author(p_note uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.notes n
      join public.note_blocks b on b.blocker_id = n.author_id
     where n.id = p_note
       and b.blocked_id = p_user
  );
$$;
revoke execute on function private.note_blocked_by_author(uuid, uuid) from public, anon;
grant execute on function private.note_blocked_by_author(uuid, uuid) to authenticated;

create policy note_likes_not_blocked on public.note_likes
  as restrictive for insert to authenticated
  with check (not private.note_blocked_by_author(note_id, user_id));

-- Same body as before, plus: a blocked person cannot reply.
create or replace function private.can_reply_to_note(p_parent uuid, p_replier uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from public.notes n
     where n.id = p_parent
       and n.status = 'published'
       and not exists (
         select 1 from public.note_blocks b
          where b.blocker_id = n.author_id
            and b.blocked_id = p_replier
       )
       and (
         n.author_id = p_replier
         or n.reply_policy = 'everyone'
         or (
           n.reply_policy = 'following'
           and exists (
             select 1 from public.follows f
              where f.follower_id = n.author_id
                and f.following_id = p_replier
           )
         )
       )
  );
$$;

-- Authors whose notes the signed-in user must not see:
-- people he muted and people who blocked him.
create function private.my_hidden_note_authors()
returns uuid[]
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(array_agg(t.x), '{}'::uuid[])
    from (
      select muted_id as x from public.note_mutes where muter_id = (select auth.uid())
      union
      select blocker_id from public.note_blocks where blocked_id = (select auth.uid())
    ) t;
$$;
revoke execute on function private.my_hidden_note_authors() from public, anon;
grant execute on function private.my_hidden_note_authors() to authenticated;

create function public.my_hidden_note_authors()
returns uuid[]
language sql
stable
security invoker
set search_path to ''
as $$
  select private.my_hidden_note_authors();
$$;
revoke execute on function public.my_hidden_note_authors() from public, anon;
grant execute on function public.my_hidden_note_authors() to authenticated;