# Security model

There is no login. This is a deliberate MVP tradeoff, not an oversight —
here's what it means and what actually protects the data.

## The session id is the credential

A session's id is a random (122-bit) UUID. Knowing it is what grants access
to that session's preferences, swipes, and match — exactly like an "anyone
with the link" shared document. It is not guessable by brute force, but
anyone who has the link (or the QR code image) has full read/write access to
that one session. Don't post a session link somewhere public.

## What Row Level Security in `supabase/schema.sql` actually enforces

RLS here does **not** simulate per-user auth (there are no users). What it
enforces, for real, at the database level:

- **A slot can't be silently overwritten.** `participants` has a unique
  `(session_id, slot)` constraint and a trigger that rejects any `UPDATE` —
  once Partner A or B submits, that's final, matching the "independently,
  without seeing their answers" requirement.
- **Swipes and ratings-history are append-only** where it matters: `swipes`
  has no update/delete policy at all.
- **A match can be written once.** A trigger on `sessions` rejects any
  attempt to change `match` after it's set, and the actual write path
  (`api/finalize-match.js`) guards its `UPDATE` with `.is("match", null)` so
  two simultaneous "we have a match" writes from both partners' devices
  converge on one winner instead of racing to overwrite each other.
- **Column-level grants** restrict the browser's anon key to updating only
  the columns the app's flow actually needs (`status`, `round`, `pool`,
  etc.) on `sessions` — never `id` or `created_at`.
- **`title_cache` (the RapidAPI enrichment cache) has zero policies for the
  anon role.** Only the serverless functions, using the service role key,
  can read or write it.

## Secrets

`ANTHROPIC_API_KEY`, `TMDB_API_KEY`, `RAPIDAPI_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are read from `process.env` only, inside `api/`
and `lib/server/` — never imported into anything under `src/`, which is what
gets bundled and shipped to the browser. `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are the only credentials that intentionally reach
the browser, and the anon key is meant to be public — RLS is what's actually
load-bearing for it, per above.

## If this goes further than a couple of friends testing it

- Add per-IP or per-session rate limiting on `/api/generate-pool` and
  `/api/refine-pool` — right now nothing stops a session link from being
  replayed into repeated (billed) Claude/TMDB/RapidAPI calls.
- Consider short-lived session links (an `expires_at` column, checked before
  any write) so an old link shared into a group chat doesn't stay live
  forever.
