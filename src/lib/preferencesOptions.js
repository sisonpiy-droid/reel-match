export const MOOD_OPTIONS = [
  { value: "light_fun", label: "Light & fun" },
  { value: "intense", label: "Intense & gripping" },
  { value: "scary", label: "Scary" },
  { value: "romantic", label: "Romantic" },
  { value: "other", label: "Other" },
];

// TMDB original-language codes.
export const LANGUAGE_OPTIONS = [
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "any", label: "Any" },
];

export const CONTENT_TYPE_OPTIONS = [
  { value: "movies", label: "Movies only" },
  { value: "series", label: "Include series" },
];

export const MIN_RATING_OPTIONS = [
  { value: 6, label: "6+" },
  { value: 7, label: "7+" },
  { value: 8, label: "8+" },
  { value: 9, label: "9+", caveat: "very few titles" },
];

// Keys match lib/preferences.js's ERA_RANGES.
export const ERA_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "classic", label: "Classic (pre-2000)" },
  { value: "2000-2020", label: "2000–2020" },
  { value: "recent", label: "Recent (2021–2026)" },
];

export function emptyPreferences() {
  return {
    moods: [],
    moodText: "",
    languages: [],
    contentType: "movies",
    minRating: 6,
    eras: [],
  };
}
