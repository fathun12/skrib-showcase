-- 0032_post_language.sql
-- Run after 0031.
-- Language per post. The database only checks the SHAPE of the code; the list
-- of allowed languages lives in the app (features/posts/languages.ts).

begin;

alter table public.posts
  add column language text not null default 'en';

alter table public.posts
  add constraint posts_language_format
  check (language ~ '^[a-z]{2,3}$');

-- Guard (0014): the language is guarded like the text and the cover.
create or replace function private.guard_shared_post_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  -- SQL Editor / admin.
  if v_user is null then
    return new;
  end if;

  if new.title is not distinct from old.title
     and new.subtitle is not distinct from old.subtitle
     and new.content is not distinct from old.content
     and new.language is not distinct from old.language
     and (
       new.cover_image_url is not distinct from old.cover_image_url
       or old.status <> 'published'
       or new.status <> 'published'
     ) then
    return new;
  end if;

  if not exists (
    select 1
    from public.post_collaborators c
    where c.post_id = old.id and c.status = 'accepted'
  ) then
    return new;
  end if;

  if not exists (
    select 1
    from private.post_edit_locks l
    where l.post_id = old.id and l.holder_id = v_user
  ) then
    raise exception 'collab_not_holder';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_shared_post_write()
  from public, anon, authenticated;

drop trigger posts_guard_shared_write on public.posts;

create trigger posts_guard_shared_write
  before update of title, subtitle, content, cover_image_url, language
  on public.posts
  for each row execute function private.guard_shared_post_write();

-- save_shared_post (0011) gets one more parameter. p_language has a default,
-- so a call with the old seven arguments still works; blank = keep the language.
drop function public.save_shared_post(uuid, text, text, jsonb, text, integer, text);
drop function private.save_shared_post(uuid, text, text, jsonb, text, integer, text);

create function private.save_shared_post(
  p_post_id uuid,
  p_title text,
  p_subtitle text,
  p_content jsonb,
  p_excerpt text,
  p_reading_time_min integer,
  p_expected_status text,
  p_language text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_updated integer;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_author(p_post_id, v_user) then
    raise exception 'collab_not_allowed';
  end if;

  if p_title is null
     or p_content is null
     or jsonb_typeof(p_content) <> 'object'
     or p_expected_status is null
     or p_expected_status not in ('draft', 'published') then
    raise exception 'collab_bad_input';
  end if;

  perform 1
  from private.post_edit_locks l
  where l.post_id = p_post_id and l.holder_id = v_user
  for update;

  if not found then
    raise exception 'collab_not_holder';
  end if;

  update public.posts p
     set title = p_title,
         subtitle = nullif(btrim(coalesce(p_subtitle, '')), ''),
         content = p_content,
         excerpt = p_excerpt,
         reading_time_min = p_reading_time_min,
         language = coalesce(nullif(btrim(coalesce(p_language, '')), ''), p.language)
   where p.id = p_post_id
     and p.status = p_expected_status;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'collab_status_changed';
  end if;

  update private.post_edit_locks l
     set activity_at = now(), heartbeat_at = now()
   where l.post_id = p_post_id;
end;
$$;

create function public.save_shared_post(
  p_post_id uuid,
  p_title text,
  p_subtitle text,
  p_content jsonb,
  p_excerpt text,
  p_reading_time_min integer,
  p_expected_status text,
  p_language text default ''
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.save_shared_post(
    p_post_id, p_title, p_subtitle, p_content,
    p_excerpt, p_reading_time_min, p_expected_status, p_language
  );
$$;

revoke all on function private.save_shared_post(uuid, text, text, jsonb, text, integer, text, text)
  from public, anon;
grant execute on function private.save_shared_post(uuid, text, text, jsonb, text, integer, text, text)
  to authenticated;
revoke all on function public.save_shared_post(uuid, text, text, jsonb, text, integer, text, text)
  from public, anon;
grant execute on function public.save_shared_post(uuid, text, text, jsonb, text, integer, text, text)
  to authenticated;

commit;