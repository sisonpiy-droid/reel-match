// Combining two independent preference profiles into one set of hard
// filters. Deliberately kept deterministic and dependency-free (no Claude
// call) -- "does 7+ mean max(7, partner's 6) = 7" is arithmetic, not
// something worth spending a model call or risking a hallucinated number on.
// Shared by api/ (pool building) and src/ (showing the couple a preview of
// what got combined) -- no secrets, so it lives outside lib/server/.

const ERA_RANGES = {
  classic: [1900, 1999],
  "2000-2020": [2000, 2020],
  recent: [2021, 2026],
};

// Intersect a set of [min,max] ranges; null means "no restriction" (Any).
function intersectEras(eraLists) {
  const active = eraLists.filter((eras) => eras && eras.length && !eras.includes("any"));
  if (!active.length) return null;

  // Each partner's own multi-select is a union of ranges; the couple's
  // constraint is the union of each partner's ranges, intersected across
  // partners -- i.e. "years either partner's ranges cover" AND'd together.
  const unions = active.map((eras) =>
    eras.map((e) => ERA_RANGES[e]).filter(Boolean)
  );

  const [minYear, maxYear] = unions.reduce(
    (acc, ranges) => {
      const lo = Math.min(...ranges.map((r) => r[0]));
      const hi = Math.max(...ranges.map((r) => r[1]));
      return [Math.max(acc[0], lo), Math.min(acc[1], hi)];
    },
    [-Infinity, Infinity]
  );

  return minYear <= maxYear ? [minYear, maxYear] : null; // no overlap
}

function intersectLanguages(a, b) {
  const langA = a.includes("any") || !a.length ? null : a;
  const langB = b.includes("any") || !b.length ? null : b;
  if (!langA && !langB) return null;   // both "Any" -> no restriction
  if (!langA) return langB;
  if (!langB) return langA;
  const overlap = langA.filter((l) => langB.includes(l));
  // No shared language and neither said "Any": relax to the union rather
  // than returning an empty pool -- a couple who both picked something is
  // still better served by more options than by a hard failure.
  return overlap.length ? overlap : [...new Set([...langA, ...langB])];
}

export function combinePreferences(prefsA, prefsB) {
  const minRating = Math.max(prefsA.minRating || 6, prefsB.minRating || 6);
  const includeSeries = prefsA.contentType === "series" && prefsB.contentType === "series";
  const languages = intersectLanguages(prefsA.languages || [], prefsB.languages || []);
  const yearRange = intersectEras([prefsA.eras || [], prefsB.eras || []]);
  const moods = [...new Set([...(prefsA.moods || []), ...(prefsB.moods || [])])];

  return {
    minRating,
    includeSeries,
    languages,        // null = any
    yearRange,         // null = any, else [minYear, maxYear]
    moods,
    moodTextA: prefsA.moodText || "",
    moodTextB: prefsB.moodText || "",
  };
}
