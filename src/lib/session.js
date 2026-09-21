import { supabase } from "./supabaseClient.js";

export async function createSession(coupleId) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ couple_id: coupleId, status: "waiting_b" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSession(sessionId) {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
  if (error) throw error;
  return data;
}

export function subscribeToSession(sessionId, onChange) {
  const channel = supabase
    .channel(`session:${sessionId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, (payload) =>
      onChange(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// True if this call's UPDATE actually landed -- i.e. this client "won" the
// race to move the session forward. Lets any client trigger a transition
// (pool generation, round advance) without two clients doing it twice.
export async function claimTransition(sessionId, fromStatus, patch) {
  const { data, error } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", sessionId)
    .eq("status", fromStatus)
    .select()
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function hasSubmitted(sessionId, slot) {
  const { data } = await supabase
    .from("participants")
    .select("id")
    .eq("session_id", sessionId)
    .eq("slot", slot)
    .maybeSingle();
  return Boolean(data);
}

export async function submitPreferences(sessionId, slot, preferences) {
  const { error } = await supabase.from("participants").insert({ session_id: sessionId, slot, preferences });
  if (error) throw error;
}

export async function getParticipants(sessionId) {
  const { data, error } = await supabase.from("participants").select("slot").eq("session_id", sessionId);
  if (error) throw error;
  return data || [];
}

export function subscribeToParticipants(sessionId, onInsert) {
  const channel = supabase
    .channel(`participants:${sessionId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function recordSwipe(sessionId, slot, round, titleId, direction) {
  const { error } = await supabase.from("swipes").insert({ session_id: sessionId, slot, round, title_id: titleId, direction });
  // 23505 = unique_violation -- a double-tap re-sending the same swipe is a
  // no-op, not a failure the swiper needs to see.
  if (error && error.code !== "23505") throw error;
}

export async function getSwipes(sessionId, round) {
  const { data, error } = await supabase.from("swipes").select("slot, title_id, direction").eq("session_id", sessionId).eq("round", round);
  if (error) throw error;
  return data || [];
}

// Unfiltered by round -- used for the top-5 tiebreaker, which scores across
// every round the couple swiped through.
export async function getAllSwipes(sessionId) {
  const { data, error } = await supabase.from("swipes").select("slot, title_id, direction").eq("session_id", sessionId);
  if (error) throw error;
  return data || [];
}

export function subscribeToSwipes(sessionId, round, onInsert) {
  const channel = supabase
    .channel(`swipes:${sessionId}:${round}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "swipes", filter: `session_id=eq.${sessionId}` },
      (payload) => {
        if (payload.new.round === round) onInsert(payload.new);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function submitRating(sessionId, slot, titleId, rating) {
  const { error } = await supabase.from("ratings").upsert(
    { session_id: sessionId, slot, title_id: titleId, rating },
    { onConflict: "session_id,slot,title_id" }
  );
  if (error) throw error;
}
