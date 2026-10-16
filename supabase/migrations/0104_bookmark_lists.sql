create table public.bookmark_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint bookmark_lists_name_len check (char_length(btrim(name)) between 1 and 40),
  constraint bookmark_lists_id_user_key unique (id, user_id)
);

create unique index bookmark_lists_user_name_uidx
  on public.bookmark_lists (user_id, lower(btrim(name)));

create table public.bookmark_list_items (
  list_id uuid not null,
  user_id uuid not null default auth.uid(),
  post_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (list_id, post_id),
  constraint bookmark_list_items_list_fkey
    foreign key (list_id, user_id)
    references public.bookmark_lists (id, user_id) on delete cascade,
  constraint bookmark_list_items_bookmark_fkey
    foreign key (user_id, post_id)
    references public.bookmarks (user_id, post_id) on delete cascade
);

create index bookmark_list_items_user_post_idx
  on public.bookmark_list_items (user_id, post_id);

alter table public.bookmark_lists enable row level security;
alter table public.bookmark_list_items enable row level security;

revoke all on public.bookmark_lists from anon, authenticated;
revoke all on public.bookmark_list_items from anon, authenticated;

grant select, delete on public.bookmark_lists to authenticated;
grant insert (name), update (name) on public.bookmark_lists to authenticated;
grant select, delete on public.bookmark_list_items to authenticated;
grant insert (list_id, post_id) on public.bookmark_list_items to authenticated;

create policy bookmark_lists_select_own on public.bookmark_lists
  for select to authenticated using (user_id = auth.uid());
create policy bookmark_lists_insert_own on public.bookmark_lists
  for insert to authenticated with check (user_id = auth.uid());
create policy bookmark_lists_update_own on public.bookmark_lists
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bookmark_lists_delete_own on public.bookmark_lists
  for delete to authenticated using (user_id = auth.uid());

create policy bookmark_list_items_select_own on public.bookmark_list_items
  for select to authenticated using (user_id = auth.uid());
create policy bookmark_list_items_insert_own on public.bookmark_list_items
  for insert to authenticated with check (user_id = auth.uid());
create policy bookmark_list_items_delete_own on public.bookmark_list_items
  for delete to authenticated using (user_id = auth.uid());

create policy suspended_no_insert_bookmark_lists on public.bookmark_lists
  as restrictive for insert to authenticated
  with check (not private.is_suspended());
create policy suspended_no_update_bookmark_lists on public.bookmark_lists
  as restrictive for update to authenticated
  using (not private.is_suspended());
create policy suspended_no_insert_bookmark_list_items on public.bookmark_list_items
  as restrictive for insert to authenticated
  with check (not private.is_suspended());

create function private.bookmark_lists_check_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.bookmark_lists where user_id = new.user_id) >= 20 then
    raise exception 'bookmark_list_limit' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.bookmark_lists_check_limit() from public, anon, authenticated;

create trigger bookmark_lists_check_limit
  before insert on public.bookmark_lists
  for each row execute function private.bookmark_lists_check_limit();

insert into private.rate_limit_rules (action, max_hits, window_seconds)
values ('list_manage', 120, 600);