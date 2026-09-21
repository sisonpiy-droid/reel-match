// Shared by src/ (browser) and api/ (server) -- no secrets, so it lives
// outside lib/server/. A titleId is "movie:603" or "tv:1399": TMDB ids are
// only unique within one media type, so the pool/swipes/ratings tables need
// this compound key to avoid a movie and a show colliding on id 603.

export function makeTitleId(mediaType, tmdbId) {
  return `${mediaType}:${tmdbId}`;
}

export function parseTitleId(titleId) {
  const [mediaType, id] = String(titleId).split(":");
  return { mediaType, tmdbId: Number(id) };
}
