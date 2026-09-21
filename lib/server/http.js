// Shared Vercel Node-runtime adapter bits, mirroring the pattern in
// presence-project/api/chat.js: thin platform glue, real logic lives
// elsewhere (lib/server/pool.js, claude.js, etc.).

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function sendJson(res, status, body) {
  res.status(status).setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

// Wraps a POST-only handler so every route reports failures the same way,
// instead of five copies of try/catch with slightly different shapes.
export function postHandler(fn) {
  return async function handler(req, res) {
    if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: "bad json" });
    }
    try {
      const result = await fn(body);
      return sendJson(res, 200, result);
    } catch (e) {
      const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
      console.error(e?.stack || e?.message || String(e));
      return sendJson(res, timedOut ? 504 : 500, { error: timedOut ? "upstream_timeout" : e?.message || "failed" });
    }
  };
}
