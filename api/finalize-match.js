import { postHandler } from "../lib/server/http.js";
import { supabaseAdmin } from "../lib/server/supabaseAdmin.js";
import { getStreamingInfo } from "../lib/server/streaming.js";

// POST { sessionId, titleId } -> called by whichever client's swipe first
// detects the intersection. Looks up the title's Indian streaming links
// (the one piece only the server can fetch) and writes sessions.match.
//
// Both partners' clients can race to call this for the same title at
// nearly the same instant. That's fine: the update is guarded with
// .is("match", null), so only the first write actually lands; the loser
// gets 0 rows affected and this handler just returns the row's real match
// (which by then is the winner's) instead of erroring. The DB trigger in
// supabase/schema.sql is a second backstop against ever overwriting one.
export default postHandler(async ({ sessionId, titleId }) => {
  if (!sessionId || !titleId) throw new Error("sessionId and titleId required");

  const db = supabaseAdmin();
  const { data: session, error } = await db.from("sessions").select("title_catalog, match").eq("id", sessionId).single();
  if (error || !session) throw new Error(`session ${sessionId} not found`);

  if (session.match) return { match: session.match }; // already decided, nothing to race

  // title_catalog accumulates every title shown across all rounds, unlike
  // `pool` which only holds the current round's 30 -- so a round-1 title
  // picked from the top-5 tiebreaker is still found here even after round 2
  // replaced `pool`.
  const card = session.title_catalog?.[titleId];
  if (!card) throw new Error(`title ${titleId} was never shown in this session`);

  const { platforms } = await getStreamingInfo(db, titleId, card.imdbId);
  const match = { ...card, platforms };

  const { data: updated, error: updateErr } = await db
    .from("sessions")
    .update({ match, status: "matched" })
    .eq("id", sessionId)
    .is("match", null)
    .select("match")
    .maybeSingle();
  if (updateErr) throw updateErr;

  if (updated) return { match: updated.match };

  // Lost the race -- someone else's write landed first; hand back theirs.
  const { data: latest } = await db.from("sessions").select("match").eq("id", sessionId).single();
  return { match: latest.match };
});
