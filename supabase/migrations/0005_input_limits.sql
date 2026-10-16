-- 0005_input_limits.sql
-- Run after 0004. Database-level limits. The app already checks these with Zod,
-- but an author can write straight to the tables through the API, so the
-- database must refuse bad values itself.
-- Keep the numbers in sync with src/features/posts/limits.ts and
-- src/features/profiles/limits.ts. The slug limit is higher than the app's 80
-- on purpose: the app adds "-2", "-3", ... after a name clash.

begin;

alter table public.posts
  add constraint posts_title_length
    check (char_length(title) <= 150),
  add constraint posts_subtitle_length
    check (subtitle is null or char_length(subtitle) <= 200),
  add constraint posts_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  -- jsonb is written as text with extra spaces, so this is above the app's 500,000.
  add constraint posts_content_size
    check (length(content::text) <= 600000),
  -- Only the host is checked here; the cloud name is checked by the app.
  add constraint posts_cover_url_format
    check (
      cover_image_url is null
      or (char_length(cover_image_url) <= 500
          and cover_image_url ~ '^https://res\.cloudinary\.com/')
    ),
  add constraint posts_published_needs_title
    check (status <> 'published' or btrim(title) <> ''),
  add constraint posts_published_needs_date
    check (status <> 'published' or published_at is not null);

alter table public.profiles
  add constraint profiles_display_name_length
    check (char_length(display_name) between 1 and 50),
  add constraint profiles_avatar_url_format
    check (
      avatar_url is null
      or (char_length(avatar_url) <= 500
          and (avatar_url ~ '^https://res\.cloudinary\.com/'
               or avatar_url ~ '^https://lh3\.googleusercontent\.com/a/'))
    );

-- The signup trigger must produce values that pass the checks above,
-- otherwise signing up would fail. Name: trimmed and cut to 50 characters.
-- Avatar: only a Google profile photo is accepted from signup metadata
-- (anything else becomes NULL; the app then shows the initial letter).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_avatar text;
begin
  v_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    50
  );

  v_avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture'
  );
  if v_avatar is not null and not (
    char_length(v_avatar) <= 500
    and v_avatar ~ '^https://lh3\.googleusercontent\.com/a/'
  ) then
    v_avatar := null;
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, v_name, v_avatar);
  return new;
end;
$$;

commit;