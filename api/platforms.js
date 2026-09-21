import { postHandler } from "../lib/server/http.js";
import { supabaseAdmin } from "../lib/server/supabaseAdmin.js";
import { getStreamingInfo } from "../lib/server/streaming.js";

// POST { sessionId, titleIds: [...] } -> Indian streaming links for a
// handful of titles at once, used by the top-5 tiebreaker screen (round 2
// still had no match) so the couple can see where to watch before picking
// together. finalize-match.js handles the "lock it in" case; this one never
// writes to sessions.
export default postHandler(async ({ sessionId, titleIds }) => {
  if (!sessionId || !Array.isArray(titleIds) || !titleIds.length) {
    throw new Error("sessionId and titleIds required");
  }

  const db = supabaseAdmin();
  const { data: session, error } = await db.from("sessions").select("title_catalog").eq("id", sessionId).single();
  if (error || !session) throw new Error(`session ${sessionId} not found`);

  const entries = await Promise.all(
    titleIds.map(async (titleId) => {
      const imdbId = session.title_catalog?.[titleId]?.imdbId;
      const { platforms } = await getStreamingInfo(db, titleId, imdbId).catch(() => ({ platforms: [] }));
      return [titleId, platforms];
    })
  );
  return { platforms: Object.fromEntries(entries) };
});
