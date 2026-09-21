// Fisher-Yates, so each partner's card order is genuinely independent of the
// other's (spec: "order is randomised differently for each partner").
export function shuffle(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
