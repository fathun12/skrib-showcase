# Architecture

How Skrib is put together, and why. Short on purpose: each section is a decision that shapes the code.

## The shape of the app

```text
Browser
  |  pages (Server Components) / Server Actions / a few route handlers
  v
Next.js 16 on Vercel (one region, next to the database)
  |  features/*  : queries, actions, validation   (the brain)
  |  ui/*        : pure components                (the face)
  v
Supabase Postgres  (RLS on every table, rules in SQL)
Cloudinary (images only)  |  Brevo (mail)  |  Sentry (errors only)
```

## Function is separate from UI

The owner restyles the interface often and must not break behavior, so the two never mix.

| Layer | Holds | May import |
|---|---|---|
| `src/app` | routing only, thin pages | everything |
| `src/features` | queries, Server Actions, Zod schemas, connected components | `lib`, `ui` |
| `src/ui` | pure presentation: props in, JSX out | `ui`, small helpers, npm packages |
| `src/lib` | Supabase clients, constants, helpers | npm packages |

`ui/` cannot import `features/`, Supabase, or Server Actions. ESLint enforces it with `no-restricted-imports`, and the config is never loosened to make code pass. A "connected" component lives in its feature folder and wraps a pure `ui/` component.

## One mutation, end to end

1. The browser calls a **Server Action** with `unknown` input.
2. The action requires a signed-in user and checks the account is not suspended.
3. **Zod** validates the input (lengths, shapes, document depth and node count).
4. A **per-user rate limit** is counted in Postgres.
5. The write runs through Supabase under the user's own session, so **RLS** applies.
6. The action returns `{ ok: true | false }` and never throws a raw database error. Unexpected failures go to Sentry as a short code and message only.
7. Affected paths are revalidated.

Actions set a wanted state (`setLike({ like: true })`) instead of toggling, so a double click or a second tab cannot flip it by accident.

## Security lives in the database

- **Row Level Security on every table.** UI and app code are a convenience, not the barrier.
- **Column-level grants**: a client write may name only the granted columns; defaults such as `user_id = auth.uid()` fill the rest.
- **Security-definer functions live in a private schema**, never in an exposed one; `public` only holds thin `security invoker` wrappers.
- **Suspension is enforced in four layers**: restrictive RLS policies, guard triggers for definer functions, guards inside the edit-lock functions, and an app guard.
- No service-role key is used in client code; the one server-side admin client is limited to functions granted to that role.

## Content model

- A story is a **Tiptap JSON document** in a `jsonb` column.
- Readers get it **rendered on the server** with `@tiptap/static-renderer`: React elements, no `dangerouslySetInnerHTML`, no HTML sanitizer, and no editor JavaScript in the reader bundle.
- The editor and the reader share one extension schema, so writing looks identical to the published page.
- The server re-validates everything: allowed node and mark names, attribute shapes, own-Cloudinary image URLs, size limits.

## Reading, discovery, and ranking

- Feeds use **keyset (cursor) pagination**.
- **Search** is Postgres full text (`tsvector`, weighted title, topics, subtitle, body), with snippets and "Did you mean" from trigram similarity.
- **Popular** and **For you** are ranked in SQL from likes, saves, reads, and follows with a time decay. No AI, nothing leaves the database.
- Author insights are **counts only**: no cookie, no IP, no reader id stored.

## Collaboration

Co-authors share a story through a **turn-based edit lock** ("one pen"), kept in the database: heartbeat, request a turn, hand over, automatic transfer after silence. Real-time simultaneous typing was left out on purpose, because it would need a WebSocket server. An editor role can fix a draft and send it back with a note.

## Offline

A small hand-written service worker serves an offline page and keeps copies of stories the reader pressed Save on (including their images). Copies are deleted when the signed-in user changes, so nothing from one account can show for another on a shared device.

## Database changes

Every change is a numbered SQL file in `supabase/migrations/`, applied by hand in order; applied files are never edited. Generated TypeScript types come from the live schema after each change.