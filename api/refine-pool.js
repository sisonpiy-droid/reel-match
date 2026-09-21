import { postHandler } from "../lib/server/http.js";
import { buildPool } from "../lib/server/pool.js";

// POST { sessionId } -> called after a no-match round. Reads the round's
// right-swipe lists itself, asks Claude to lean into what both partners
// actually responded to, and builds round 2's pool (deduped against
// everything already shown).
export default postHandler(async ({ sessionId }) => {
  if (!sessionId) throw new Error("sessionId required");
  return buildPool(sessionId, "refine");
});
