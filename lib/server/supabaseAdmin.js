import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

// Service-role client: bypasses RLS entirely. Only ever imported from api/ --
// never bundle this into src/, or the service role key ships to the browser.
let client;
export function supabaseAdmin() {
  if (client) return client;
  client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  return client;
}
