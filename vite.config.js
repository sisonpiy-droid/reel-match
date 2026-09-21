import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local dev proxies /api to the plain-Node harness in scripts/dev-api.mjs,
// which mounts the same Vercel function handlers -- so "npm run dev" behaves
// like production without needing the Vercel CLI.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
