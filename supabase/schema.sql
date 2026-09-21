-- Reel Match schema. Run this once in the Supabase SQL editor (or via the
-- CLI) on a fresh project. Safe to re-run: everything is CREATE ... IF NOT
-- EXISTS / OR REPLACE.
--
-- Security model (see SECURITY.md for the full writeup): there is no login.
-- A session's id (a random uuid) IS the access credential -- exactly like an
-- "anyone with the link" Google Doc. RLS here is deliberately permissive on
-- rows the app never lists in bulk; what it enforces for real is (a) you
-- cannot silently overwrite another partner's slot, (b) swipes/ratings are
-- append-only, (c) a match can be written once and never changed after, and
-- (d) the browser can only ever touch the columns the app actually needs.
-- Never add a "list all sessions" query against these tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
create table if not exists couples (
  id text primary key,          -- random id minted client-side, kept in localStorage
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting_b'
    check (status in ('waiting_b', 'collecting', 'generating', 'swiping', 'matched', 'no_match_final')),
  round int not null default 1,
  pool jsonb not null default '[]'::jsonb,          -- current round's up-to-30 titles
  seen_title_ids jsonb not null default '[]'::jsonb, -- dedup across rounds
  title_catalog jsonb not null default '{}'::jsonb,  -- {titleId: card} for every title shown this session, any round -- pool gets replaced each round, this doesn't, so round-1 titles are still renderable in the top-5 tiebreaker
  brief jsonb,                                       -- last Claude-generated search brief (debug/reuse)
  match jsonb,                                       -- winning title's full detail + IN streaming links
  couple_id text references couples(id),
  created_at timestamptz not null default now()
);

-- Once a match is written, it cannot change. Without this, two clients that
-- both detect a match at nearly the same moment could overwrite each other's
-- write with a *different* title, and the two screens would desync.
create or replace function sessions_match_is_final()
returns trigger language plpgsql as $$
begin
  if old.match is not null and new.match is distinct from old.match then
    raise exception 'session % already has a match; it cannot be changed', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sessions_match_is_final on sessions;
create trigger trg_sessions_match_is_final
  before update on sessions
  for each row execute function sessions_match_is_final();

-- ---------------------------------------------------------------------------
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  slot text not null check (slot in ('A', 'B')),
  preferences jsonb not null,
  submitted_at timestamptz not null default now(),
  unique (session_id, slot)
);

-- Preferences are locked the instant they're submitted -- "without seeing
-- Partner A's answers" only holds if neither side can edit after the fact.
create or replace function participants_preferences_are_final()
returns trigger language plpgsql as $$
begin
  raise exception 'preferences for session % slot % are already submitted', old.session_id, old.slot;
  return new;
end;
$$;

drop trigger if exists trg_participants_locked on participants;
create trigger trg_participants_locked
  before update on participants
  for each row execute function participants_preferences_are_final();

-- ---------------------------------------------------------------------------
create table if not exists swipes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  slot text not null check (slot in ('A', 'B')),
  round int not null,
  title_id text not null,       -- "movie:603" / "tv:1399" (see src/lib/titleId.js)
  direction text not null check (direction in ('left', 'right')),
  created_at timestamptz not null default now(),
  unique (session_id, slot, round, title_id)
);

create index if not exists swipes_session_round_idx on swipes (session_id, round);

-- ---------------------------------------------------------------------------
create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  slot text not null check (slot in ('A', 'B')),
  title_id text not null,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (session_id, slot, title_id)
);

-- ---------------------------------------------------------------------------
-- Server-only enrichment cache (RapidAPI imdbRating + streaming links per
-- title). Touched only by the serverless functions via the service role
-- key, which bypasses RLS entirely -- no policy here grants the browser
-- anything, intentionally.
create table if not exists title_cache (
  title_id text primary key,
  imdb_rating numeric,
  streaming jsonb,               -- IN platform list, refreshed lazily
  fetched_at timestamptz not null default now()
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table couples enable row level security;
alter table sessions enable row level security;
alter table participants enable row level security;
alter table swipes enable row level security;
alter table ratings enable row level security;
alter table title_cache enable row level security;
-- title_cache: no policies at all for anon/authenticated -> default deny.

drop policy if exists couples_upsert on couples;
create policy couples_upsert on couples for insert to anon with check (true);
drop policy if exists couples_select on couples;
create policy couples_select on couples for select to anon using (true);

drop policy if exists sessions_select on sessions;
create policy sessions_select on sessions for select to anon using (true);
drop policy if exists sessions_insert on sessions;
create policy sessions_insert on sessions for insert to anon with check (true);
drop policy if exists sessions_update on sessions;
create policy sessions_update on sessions for update to anon using (true) with check (true);

-- Column-level grants: RLS controls which *rows*, GRANT controls which
-- *columns* -- the browser can move a session through its lifecycle but can
-- never touch id/created_at, and (belt-and-suspenders with the trigger
-- above) writing `match` still goes through the same update policy.
revoke update on sessions from anon;
grant update (status, round, pool, seen_title_ids, title_catalog, brief, match, couple_id) on sessions to anon;
grant select, insert on sessions to anon;

drop policy if exists participants_select on participants;
create policy participants_select on participants for select to anon using (true);
drop policy if exists participants_insert on participants;
create policy participants_insert on participants for insert to anon with check (true);
-- No update policy: combined with the trigger above, a slot's preferences
-- are write-once from both the RLS and the trigger side.

drop policy if exists swipes_select on swipes;
create policy swipes_select on swipes for select to anon using (true);
drop policy if exists swipes_insert on swipes;
create policy swipes_insert on swipes for insert to anon with check (true);
-- No update/delete policy: swipes are append-only.

drop policy if exists ratings_select on ratings;
create policy ratings_select on ratings for select to anon using (true);
drop policy if exists ratings_insert on ratings;
create policy ratings_insert on ratings for insert to anon with check (true);
drop policy if exists ratings_update on ratings;
create policy ratings_update on ratings for update to anon using (true) with check (true);
-- Unlike swipes, a rating can be corrected -- upsert on (session_id, slot,
-- title_id) is how src/lib/session.js submits it.

-- ===========================================================================
-- Realtime: publish the tables clients need to subscribe to.
-- ===========================================================================
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table swipes;
