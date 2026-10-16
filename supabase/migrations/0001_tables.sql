-- 0001_tables.sql
-- Core tables for Skrib. Run this first in the Supabase SQL Editor.

-- profiles: 1-1 with auth.users.
-- ASSUMPTION (deviates from spec): username is NULLABLE. The profile row is
-- created automatically at signup, before the user picks a username in
-- onboarding. NULL means "not onboarded yet". UNIQUE still allows many NULLs.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),

  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_-]{3,30}$'),
  -- /[username] is a top-level route, so these must never be claimed.
  -- Keep in sync with RESERVED_USERNAMES in src/lib/constants.ts.
  constraint profiles_username_reserved
    check (username is null or username not in (
      'write', 'me', 'settings', 'login', 'signup', 'register', 'logout',
      'auth', 'api', 'admin', 'about', 'explore', 'tag', 'tags', 'search',
      'onboarding', 'welcome', 'new', 'edit', 'help', 'support', 'privacy',
      'terms', 'feed', 'home', 'rss', 'sitemap', 'robots', 'user', 'users',
      'profile', 'post', 'posts', 'stories', 'null', 'undefined'
    )),
  constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 280)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '',
  subtitle text,
  slug text not null,
  content jsonb not null default '{}'::jsonb,  -- Tiptap JSON document
  excerpt text,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  reading_time_min int,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, slug)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- Indexes
create index posts_author_status_published_idx
  on public.posts (author_id, status, published_at desc);
create index posts_status_published_idx
  on public.posts (status, published_at desc);
create index follows_following_idx on public.follows (following_id);
create index likes_post_idx on public.likes (post_id);