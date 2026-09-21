// When RapidAPI has no tracked India streaming entry for a title (its
// coverage is inconsistent -- see README), give the couple somewhere to
// actually look instead of a dead end.
export function fallbackLinks(title, year) {
  const q = encodeURIComponent([title, year].filter(Boolean).join(" "));
  return [
    { label: "Search YouTube", href: `https://www.youtube.com/results?search_query=${q}` },
    { label: "Check JustWatch (all countries)", href: `https://www.justwatch.com/in/search?q=${q}` },
  ];
}
