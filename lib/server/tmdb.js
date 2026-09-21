import { requireEnv, upstreamTimeoutMs } from "./env.js";
import { makeTitleId } from "../titleId.js";

const BASE = "https://api.themoviedb.org/3";

// TMDB's genre lists are fixed, documented, public data (not a secret, not
// something that changes) -- hardcoding avoids a genre-name-to-id round trip
// on every brief. Movie and TV use different id spaces for a few names.
const MOVIE_GENRES = {
  action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80,
  documentary: 99, drama: 18, family: 10751, fantasy: 14, history: 36,
  horror: 27, music: 10402, mystery: 9648, romance: 10749,
  "science fiction": 878, "sci-fi": 878, "tv movie": 10770, thriller: 53,
  war: 10752, western: 37,
};
const TV_GENRES = {
  "action & adventure": 10759, action: 10759, adventure: 10759, animation: 16,
  comedy: 35, crime: 80, documentary: 99, drama: 18, family: 10751,
  kids: 10762, mystery: 9648, news: 10763, reality: 10764,
  "sci-fi & fantasy": 10765, "science fiction": 10765, fantasy: 10765,
  soap: 10766, talk: 10767, "war & politics": 10768, western: 37,
};

function genreIds(names, map) {
  return [...new Set(names.map((n) => map[n.toLowerCase()]).filter(Boolean))];
}

async function tmdbGet(path, params) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_key", requireEnv("TMDB_API_KEY"));
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(upstreamTimeoutMs()) });
  const data = await r.json();
  if (!r.ok) throw new Error(`TMDB ${r.status} on ${path}: ${data?.status_message || "no detail"}`);
  return data;
}

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";

function normalize(raw, mediaType) {
  const title = mediaType === "movie" ? raw.title : raw.name;
  const dateStr = mediaType === "movie" ? raw.release_date : raw.first_air_date;
  return {
    id: makeTitleId(mediaType, raw.id),
    mediaType,
    tmdbId: raw.id,
    title,
    year: dateStr ? Number(dateStr.slice(0, 4)) : null,
    posterUrl: raw.poster_path ? `${POSTER_BASE}${raw.poster_path}` : null,
    overview: raw.overview || "",
    tmdbRating: typeof raw.vote_average === "number" ? raw.vote_average : null,
  };
}

// TMDB's discover endpoint only accepts a single with_original_language
// value -- there's no "language IN (hi, en)" param -- so a couple that picked
// two or more specific languages needs one discover call per language,
// merged afterward. `undefined` runs a single unrestricted pass ("Any").
async function discoverOneLanguage(mediaType, genreMap, language, { brief, yearRange, page }) {
  const params = {
    sort_by: brief.sort_by || "popularity.desc",
    page,
    "vote_count.gte": 20, // filters out zero-review noise
  };
  if (language) params.with_original_language = language;

  const dateField = mediaType === "movie" ? "primary_release_date" : "first_air_date";
  if (yearRange) {
    params[`${dateField}.gte`] = `${yearRange[0]}-01-01`;
    params[`${dateField}.lte`] = `${yearRange[1]}-12-31`;
  }

  const includeIds = genreIds(brief.genres || [], genreMap);
  const excludeIds = genreIds(brief.exclude_genres || [], genreMap);
  if (includeIds.length) params.with_genres = includeIds.join(",");
  if (excludeIds.length) params.without_genres = excludeIds.join(",");

  const data = await tmdbGet(`/discover/${mediaType}`, params);
  return (data.results || []).map((r) => normalize(r, mediaType));
}

// includeSeries: false -> movies only. languages: array of TMDB language
// codes or null for any. yearRange: [min,max] or null.
export async function discover({ brief, includeSeries, languages, yearRange, page = 1 }) {
  const langPasses = languages?.length ? languages : [undefined];

  const movieBatches = await Promise.all(
    langPasses.map((lang) => discoverOneLanguage("movie", MOVIE_GENRES, lang, { brief, yearRange, page }))
  );
  const results = movieBatches.flat();

  if (includeSeries) {
    const tvBatches = await Promise.all(
      langPasses.map((lang) => discoverOneLanguage("tv", TV_GENRES, lang, { brief, yearRange, page }))
    );
    results.push(...tvBatches.flat());
  }

  return results;
}

// Discover has no full-text search; this is how the free-text mood nuance
// (via Claude's search_phrases) actually reaches TMDB.
export async function searchByPhrase(phrase, { includeSeries }) {
  const results = [];
  const movieData = await tmdbGet("/search/movie", { query: phrase, include_adult: false });
  results.push(...(movieData.results || []).slice(0, 8).map((r) => normalize(r, "movie")));
  if (includeSeries) {
    const tvData = await tmdbGet("/search/tv", { query: phrase, include_adult: false });
    results.push(...(tvData.results || []).slice(0, 8).map((r) => normalize(r, "tv")));
  }
  return results;
}

// Runtime isn't on discover/search list items -- movies need /movie/{id},
// TV needs /tv/{id} (episode_run_time, since a show has no single runtime).
// Also the only place that gets an imdb_id: RapidAPI's OTT Details API
// (lib/server/streaming.js) is keyed by IMDb id, not TMDB id, and TV only
// exposes its imdb_id via append_to_response=external_ids.
export async function fetchDetails(mediaType, tmdbId) {
  if (mediaType === "movie") {
    const data = await tmdbGet(`/movie/${tmdbId}`, {});
    return { runtimeMinutes: data.runtime || null, imdbId: data.imdb_id || null };
  }
  const data = await tmdbGet(`/tv/${tmdbId}`, { append_to_response: "external_ids" });
  return {
    runtimeMinutes: data.episode_run_time?.[0] || data.last_episode_to_air?.runtime || null,
    imdbId: data.external_ids?.imdb_id || null,
  };
}
