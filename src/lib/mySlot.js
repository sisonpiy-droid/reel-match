// Which slot ("A" or "B") this browser is playing in a given session --
// persisted so a refresh mid-swipe doesn't re-ask the preference form or
// lose track of which right-swipe list is "mine" vs "theirs".
const keyFor = (sessionId) => `reelmatch.slot.${sessionId}`;

export function getMySlot(sessionId) {
  return localStorage.getItem(keyFor(sessionId));
}

export function setMySlot(sessionId, slot) {
  localStorage.setItem(keyFor(sessionId), slot);
}

export function otherSlot(slot) {
  return slot === "A" ? "B" : "A";
}
