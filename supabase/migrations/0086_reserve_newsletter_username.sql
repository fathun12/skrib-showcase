-- 0086_reserve_newsletter_username.sql
-- /newsletter/confirm and /newsletter/unsubscribe are real pages, so the
-- name "newsletter" cannot be a username. Same list as 0057 plus one name.
-- Keep in sync with RESERVED_USERNAMES in src/lib/constants.ts.
begin;

alter table public.profiles
  drop constraint profiles_username_not_reserved;

alter table public.profiles
  add constraint profiles_username_not_reserved
  check (
    username is null
    or username <> all (array[
      'write', 'me', 'settings', 'login', 'signup', 'register', 'logout',
      'auth', 'api', 'admin', 'about', 'explore', 'tag', 'tags', 'search',
      'onboarding', 'welcome', 'new', 'edit', 'help', 'support', 'privacy',
      'terms', 'feed', 'home', 'rss', 'sitemap', 'robots', 'user', 'users',
      'profile', 'post', 'posts', 'stories', 'null', 'undefined', 'notes',
      'newsletter'
    ])
  );

commit;