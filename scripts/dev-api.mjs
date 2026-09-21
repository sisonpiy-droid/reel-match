/* Local stand-in for the deployed Vercel functions, so pool generation can
   be exercised without deploying: real Claude/TMDB/RapidAPI calls (or
   loudly-failing placeholder-key errors), real Supabase writes.

   Run:  npm run dev:api      (reads .env)
   Then: npm run dev          (Vite proxies /api here, see vite.config.js)

   Not what runs in production -- that's the api/*.js files on Vercel, which
   this loads directly. Node's plain http response lacks Vercel's res.status()
   helper, so it's polyfilled just enough for lib/server/http.js to work. */

import { createServer } from "node:http";
import generatePool from "../api/generate-pool.js";
import refinePool from "../api/refine-pool.js";
import finalizeMatch from "../api/finalize-match.js";
import platforms from "../api/platforms.js";

const PORT = Number(process.env.DEV_API_PORT || 8787);

const routes = {
  "/api/generate-pool": generatePool,
  "/api/refine-pool": refinePool,
  "/api/finalize-match": finalizeMatch,
  "/api/platforms": platforms,
};

function withVercelShim(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  return res;
}

createServer(async (req, res) => {
  withVercelShim(res);
  const handler = routes[req.url.split("?")[0]];
  if (!handler) {
    res.status(404).setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "not found" }));
  }
  await handler(req, res);
  console.log(`${req.method} ${req.url} -> ${res.statusCode}`);
}).listen(PORT, () => {
  console.log(`dev api on http://localhost:${PORT}`);
});
