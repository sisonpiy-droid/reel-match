import { createClient } from "@supabase/supabase-js";

// Anon key only -- safe to ship to the browser because RLS + column grants
// (supabase/schema.sql) do the real gatekeeping, not this key.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set -- copy .env.example to .env.local and fill them in."
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder", {
  auth: { persistSession: false },
});
