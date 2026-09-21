# Reel Match

Two people, one QR code, thirty titles, one swipe session. Built so a couple
never has to scroll a streaming app's home screen arguing about what to
watch — set your mood independently, swipe on the same shortlist, and see
exactly where to stream the thing you both liked, in India, right now.

## How it works

1. Partner A sets mood, language, content type, minimum rating, and era, and
   gets a QR code / link to share.
2. Partner B scans or opens the link and fills in the same form —
   independently, without seeing A's answers.
3. Once both are in, Claude reads both preference profiles (including the
   free-text mood description) and produces a search brief; the app pulls 30
   matching titles from TMDB.
4. Both partners swipe the same 30 titles, independently shuffled. A mutual
   right-swipe is a match — revealed to both screens at once, with direct
   links to every Indian streaming service (via RapidAPI) it's currently on.
5. No match after round 1 → Claude leans into what was actually liked and
   generates a fresh, deduped round 2. Still no match → top 5 by combined
   right-swipe score, and the couple picks together.
6. The full session (both preference profiles, every swipe, the match, and
   an optional post-watch rating) is saved, and future sessions on the same
   device get smarter about what this couple actually enjoys.

## Layout

```
index.html, src/                the React app (Vite)
api/generate-pool.js            round 1: build the 30-title pool
api/refine-pool.js              round 2: rebuild after a no-match round
api/finalize-match.js           lock in a match + fetch its IN streaming links
api/platforms.js                streaming links for the top-5 tiebreaker
lib/server/                     Claude / TMDB / RapidAPI / Supabase-admin clients
lib/preferences.js              combining two partners' hard constraints (no AI)
lib/titleId.js                  "movie:603" / "tv:1399" compound id helpers
supabase/schema.sql             tables, RLS policies, realtime publication
scripts/dev-api.mjs             runs the api/ functions locally without Vercel
```

## Setup

1. **Supabase**: create a project, run `supabase/schema.sql` in the SQL
   editor. Copy the project URL, publishable (anon) key, and secret
   (service role) key — Supabase's newer projects name these
   `sb_publishable_...` / `sb_secret_...`; they're a drop-in swap for
   `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
2. **TMDB**: create an API key at themoviedb.org/settings/api — use the
   **v3 API Key**, not the v4 read access token (a long JWT); `lib/server/
   tmdb.js` sends it as an `api_key` query param, which only the v3 key is.
3. **RapidAPI**: subscribe to the "OTT Details" API (a free tier exists) and
   copy your RapidAPI key. It's per-API — a key from a different RapidAPI
   subscription returns a 403.
4. **An LLM key**: either `ANTHROPIC_API_KEY` (the product's intended
   provider) or `GEMINI_API_KEY` (a free-tier fallback) — `lib/server/
   claude.js` picks whichever is set, same pattern as `presence-project`.
5. Copy `.env.example` to `.env` and fill in all of the above (locally) — in
   production, set the same names in the Vercel project's environment
   variables instead.
6. `npm install`

## Running locally

```
npm run dev:api     # terminal 1 -- the api/ functions, reading .env
npm run dev          # terminal 2 -- Vite, proxying /api to the above
```

Open the printed localhost URL on two different browser profiles (or one
normal + one incognito window) to play both partners.

## Deploying

Push to a repo, import it into Vercel, set the environment variables listed
in `.env.example` (including the `VITE_`-prefixed ones, which get baked into
the build) in the Vercel dashboard, and deploy. `vercel.json` handles the
SPA rewrite so client-side routes (`/join/:id`, `/session/:id`) work on a
hard refresh.

## Known limitations (read before a real session with real people)

- **RapidAPI (OTT Details) has inconsistent per-title coverage.** Confirmed
  working end-to-end against real data, but some titles come back with a
  streaming section that's missing India entirely, or no `imdbrating` field
  at all -- that's the upstream dataset, not a bug here. The app already
  handles it: `displayRating`/`ratingSource` fall back to TMDB's own rating,
  and an empty platform list just renders as "not currently streaming."
- **Return-visit history is per-browser, not per-couple across devices.**
  Partner A's "we've enjoyed X before" personalization lives in that
  browser's localStorage id. A different device starts fresh.
- **No auth.** A session's URL/QR code *is* its access control — anyone with
  the link can read or add to that session, the same trust model as an
  "anyone with the link" shared doc. See `SECURITY.md`.
- **Rate limiting**: none yet. A public deployment should add a per-IP or
  per-session limit on `/api/generate-pool` and `/api/refine-pool` before
  sharing the link widely — see `presence-project/lib/chat-core.js`'s
  `overLimit()` for a pattern to lift, if this ever needs it.
