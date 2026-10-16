// Must match the CHECK constraint in supabase/migrations/0001_tables.sql
export const RESERVED_USERNAMES = [
  "write", "me", "settings", "login", "signup", "register", "logout",
  "auth", "api", "admin", "about", "explore", "tag", "tags", "search",
  "onboarding", "welcome", "new", "edit", "help", "support", "privacy",
  "terms", "feed", "home", "rss", "sitemap", "robots", "user", "users",
  "profile", "post", "posts", "stories", "null", "undefined", "notes",
  "newsletter",
] as const;

export const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;