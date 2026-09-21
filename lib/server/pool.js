import { supabaseAdmin } from "./supabaseAdmin.js";
import { getSearchBrief } from "./claude.js";
import { discover, searchByPhrase, fetchDetails } from "./tmdb.js";
import { getStreamingInfo } from "./streaming.js";
import { combinePreferences } from "../preferences.js";

const POOL_SIZE = 30;
const CANDIDATE_CAP = 45; // bounds TMDB detail + RapidAPI calls per pool build

async function mapWithConcurrency(items, limit, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function oneLineSynopsis(overview) {
  if (!overview) return "";
  const clipped = overview.slice(0, 160);
  if (overview.length <= 160) return overview;
  return clipped.slice(0, clipped.lastIndexOf(" ")) + "…";
}

function dedupe(candidates) {
  const seen = new Set();
  return candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

async function pastRightSwipeTitles(db, sessionId, round) {
  const { data } = await db
    .from("swipes")
    .select("slot, title_id")
    .eq("session_id", sessionId)
    .eq("round", round)
    .eq("direction", "right");
  const bySlot = { A: new Set(), B: new Set() };
  for (const row of data || []) bySlot[row.slot]?.add(row.title_id);
  return bySlot;
}

async function coupleHistory(db, coupleId) {
  if (!coupleId) return null;
  const { data: sessions } = await db.from("sessions").select("id, match").eq("couple_id", coupleId);
  const titleIds = (sessions || []).map((s) => s.match?.title).filter(Boolean);
  if (!titleIds.length) return null;

  const sessionIds = (sessions || []).map((s) => s.id);
  const { data: ratings } = await db.from("ratings").select("title_id, rating").in("session_id", sessionIds);

  const loved = new Set(), disliked = new Set();
  const titleById = new Map((sessions || []).map((s) => [s.match?.id, s.match?.title]).filter(([id]) => id));
  for (const r of ratings || []) {
    const name = titleById.get(r.title_id);
    if (!name) continue;
    if (r.rating >= 4) loved.add(name);
    else if (r.rating <= 2) disliked.add(name);
  }
  return { loved: [...loved], disliked: [...disliked] };
}

/* mode: "initial" (round 1) | "refine" (round 2+) */
export async function buildPool(sessionId, mode = "initial") {
  const db = supabaseAdmin();

  const { data: session, error: sessionErr } = await db.from("sessions").select("*").eq("id", sessionId).single();
  if (sessionErr || !session) throw new Error(`session ${sessionId} not found`);

  const { data: participants, error: partErr } = await db
    .from("participants")
    .select("slot, preferences")
    .eq("session_id", sessionId);
  if (partErr) throw partErr;

  const a = participants?.find((p) => p.slot === "A")?.preferences;
  const b = participants?.find((p) => p.slot === "B")?.preferences;
  if (!a || !b) throw new Error("both partners must submit preferences before a pool can be built");

  const combined = combinePreferences(a, b);
  const seenIds = new Set(session.seen_title_ids || []);

  let context = { mode };
  if (mode === "refine") {
    const priorRound = session.round;
    const swipesBySlot = await pastRightSwipeTitles(db, sessionId, priorRound);
    const pool = session.pool || [];
    const titleOf = (id) => pool.find((t) => t.id === id)?.title || id;
    const both = [...swipesBySlot.A].filter((id) => swipesBySlot.B.has(id));
    const either = new Set([...swipesBySlot.A, ...swipesBySlot.B]);
    context.round1 = { likedByBoth: both.map(titleOf), likedByEither: [...either].map(titleOf) };
  }
  context.coupleHistory = await coupleHistory(db, session.couple_id);

  const brief = await getSearchBrief(combined, context);

  const discovered = await discover({
    brief,
    includeSeries: combined.includeSeries,
    languages: combined.languages,
    yearRange: combined.yearRange,
  });

  const phraseResults = await mapWithConcurrency(
    (brief.search_phrases || []).slice(0, 5),
    3,
    (phrase) => searchByPhrase(phrase, { includeSeries: combined.includeSeries }).catch(() => [])
  );

  let candidates = dedupe([...discovered, ...phraseResults.flat()])
    .filter((c) => !seenIds.has(c.id))
    .slice(0, CANDIDATE_CAP);

  const enriched = await mapWithConcurrency(candidates, 6, async (c) => {
    // Sequential, not parallel: the RapidAPI lookup is keyed by IMDb id,
    // which only TMDB's own detail endpoint provides (see fetchDetails).
    const { runtimeMinutes, imdbId } = await fetchDetails(c.mediaType, c.tmdbId).catch(() => ({ runtimeMinutes: null, imdbId: null }));
    const streaming = await getStreamingInfo(db, c.id, imdbId).catch(() => ({ imdbRating: null }));
    const imdbRating = streaming.imdbRating;
    return {
      ...c,
      runtimeMinutes,
      imdbId,
      imdbRating,
      ratingSource: imdbRating != null ? "imdb" : "tmdb",
      displayRating: imdbRating != null ? imdbRating : c.tmdbRating,
      synopsis: oneLineSynopsis(c.overview),
    };
  });

  const qualified = enriched.filter((c) => (c.displayRating ?? 0) >= combined.minRating);
  const pool = qualified.slice(0, POOL_SIZE).map(({ overview, tmdbRating, ...card }) => card);

  const nextRound = mode === "refine" ? session.round + 1 : session.round;
  const catalog = { ...(session.title_catalog || {}) };
  for (const card of pool) catalog[card.id] = card;

  const { error: updateErr } = await db
    .from("sessions")
    .update({
      status: "swiping",
      round: nextRound,
      pool,
      brief,
      seen_title_ids: [...seenIds, ...pool.map((t) => t.id)],
      title_catalog: catalog,
    })
    .eq("id", sessionId);
  if (updateErr) throw updateErr;

  return { pool, round: nextRound };
}
