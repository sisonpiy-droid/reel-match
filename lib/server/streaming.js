import { requireEnv, upstreamTimeoutMs } from "./env.js";

// RapidAPI "OTT Details" (ott-details.p.rapidapi.com). One endpoint,
// gettitleDetails, covers both jobs: the IMDb rating used for the "minimum
// rating" filter (TMDB's own vote_average is a different number on a
// different scale), and which Indian services a title streams on, fetched
// only for the matched / shortlisted titles, not all 30 candidates, to keep
// call volume down. It's keyed by IMDb id -- see fetchDetails() in tmdb.js
// for where that comes from.

function host() {
  return process.env.RAPIDAPI_HOST || "ott-details.p.rapidapi.com";
}

// getPlatforms?region=IN returns this same value->label mapping; hardcoded
// here for the handful of services actually worth showing a nice name for.
// Falls back to title-casing the raw slug for anything not in this list.
const PLATFORM_LABELS = {
  netflix: "Netflix",
  amazonprimevideo: "Amazon Prime Video",
  hotstar: "Disney+ Hotstar",
  zee5: "Zee5",
  sonyliv: "Sony LIV",
  jiocinema: "JioCinema",
  voot: "Voot",
  mubi: "Mubi",
  appletvplus: "Apple TV+",
  itunes: "Apple iTunes",
  play: "Google Play Movies",
  youtube: "YouTube",
  hayu: "Hayu",
  erosnow: "Eros Now",
  sunnxt: "Sun NXT",
  hoichoi: "Hoichoi",
  altbalaji: "ALTBalaji",
};

function labelFor(slug) {
  return PLATFORM_LABELS[slug] || slug.replace(/^\w/, (c) => c.toUpperCase());
}

function normalize(raw) {
  if (!raw) return { imdbRating: null, platforms: [] };

  const inOptions = raw.streamingAvailability?.country?.IN || [];
  const platforms = inOptions.map((opt) => ({ service: labelFor(opt.platform), link: opt.url || null }));

  return {
    imdbRating: typeof raw.imdbrating === "number" ? raw.imdbrating : null,
    platforms,
  };
}

async function fetchFromRapidApi(imdbId) {
  const url = `https://${host()}/gettitleDetails?imdbid=${encodeURIComponent(imdbId)}`;
  const r = await fetch(url, {
    signal: AbortSignal.timeout(upstreamTimeoutMs()),
    headers: {
      "x-rapidapi-key": requireEnv("RAPIDAPI_KEY"),
      "x-rapidapi-host": host(),
    },
  });
  const data = await r.json();
  if (process.env.DEBUG_STREAMING === "1") {
    console.log("[ott-details raw]", imdbId, JSON.stringify(data).slice(0, 2000));
  }
  if (!r.ok) throw new Error(`RapidAPI OTT Details ${r.status} for ${imdbId}`);
  return normalize(data);
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // platform availability shifts; 6h keeps calls down without going stale for a single movie night

// db: supabaseAdmin() client, passed in rather than imported so this module
// stays testable without a real Supabase connection. imdbId may be null for
// obscure titles TMDB couldn't resolve one for -- callers get back nulls
// rather than an error, since a missing rating just excludes the title
// later rather than failing the whole pool build.
export async function getStreamingInfo(db, titleId, imdbId) {
  if (!imdbId) return { imdbRating: null, platforms: [] };

  const { data: cached } = await db.from("title_cache").select("*").eq("title_id", titleId).maybeSingle();
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
    return { imdbRating: cached.imdb_rating, platforms: cached.streaming || [] };
  }

  const fresh = await fetchFromRapidApi(imdbId);
  await db.from("title_cache").upsert({
    title_id: titleId,
    imdb_rating: fresh.imdbRating,
    streaming: fresh.platforms,
    fetched_at: new Date().toISOString(),
  });
  return fresh;
}
