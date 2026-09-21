import { postHandler } from "../lib/server/http.js";
import { buildPool } from "../lib/server/pool.js";

// POST { sessionId } -> reads both partners' preferences from Supabase
// itself (never trusts the client to hand over prefs), builds round 1's
// pool of ~30 titles, writes it to sessions.pool, returns it.
export default postHandler(async ({ sessionId }) => {
  if (!sessionId) throw new Error("sessionId required");
  return buildPool(sessionId, "initial");
});
