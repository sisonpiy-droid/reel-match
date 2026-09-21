import { supabase } from "./supabaseClient.js";

const KEY = "reelmatch.coupleId";

// Browser-local identity for "returning couple" personalization -- no login.
// Only Partner A's device carries this across sessions (per product decision:
// works on that device/browser only, not cross-device). Partner B joining
// from a link never needs one.
export function getOrCreateCoupleId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export async function ensureCoupleRow(coupleId) {
  // ignoreDuplicates rather than a plain insert: every return visit hits the
  // same row, and that's the expected case, not an error to handle.
  await supabase.from("couples").upsert({ id: coupleId }, { onConflict: "id", ignoreDuplicates: true });
}
