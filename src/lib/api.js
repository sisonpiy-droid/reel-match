// Thin wrapper over the three secret-holding serverless endpoints. Everything
// else in the app talks to Supabase directly (see session.js).
async function post(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `${path} failed (${r.status})`);
  return data;
}

export const generatePool = (sessionId) => post("/api/generate-pool", { sessionId });
export const refinePool = (sessionId) => post("/api/refine-pool", { sessionId });
export const finalizeMatch = (sessionId, titleId) => post("/api/finalize-match", { sessionId, titleId });
export const fetchPlatforms = (sessionId, titleIds) => post("/api/platforms", { sessionId, titleIds });
