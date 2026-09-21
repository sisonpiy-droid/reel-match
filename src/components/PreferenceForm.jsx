import { useState } from "react";
import ChipGroup from "./ChipGroup.jsx";
import {
  MOOD_OPTIONS,
  LANGUAGE_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  MIN_RATING_OPTIONS,
  ERA_OPTIONS,
  emptyPreferences,
} from "../lib/preferencesOptions.js";

// Used by both Partner A (Home) and Partner B (Join) -- it never has access
// to the other partner's answers, so "independently, without seeing their
// answers" is just a property of what this component is given, not
// something it has to actively hide.
export default function PreferenceForm({ onSubmit, submitting }) {
  const [prefs, setPrefs] = useState(emptyPreferences());

  function set(field, val) {
    setPrefs((p) => ({ ...p, [field]: val }));
  }

  const canSubmit = prefs.moods.length > 0 && !submitting;

  return (
    <form
      className="preference-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(prefs);
      }}
    >
      <section>
        <h3>Mood</h3>
        <ChipGroup options={MOOD_OPTIONS} value={prefs.moods} multi onChange={(v) => set("moods", v)} />
        <textarea
          className="mood-text"
          placeholder="Describe what you're in the mood for tonight (optional)"
          value={prefs.moodText}
          onChange={(e) => set("moodText", e.target.value)}
          maxLength={280}
        />
      </section>

      <section>
        <h3>Language</h3>
        <ChipGroup
          options={LANGUAGE_OPTIONS}
          value={prefs.languages}
          multi
          anyValue="any"
          onChange={(v) => set("languages", v)}
        />
      </section>

      <section>
        <h3>Content type</h3>
        <ChipGroup options={CONTENT_TYPE_OPTIONS} value={prefs.contentType} onChange={(v) => set("contentType", v)} />
      </section>

      <section>
        <h3>Minimum IMDb rating</h3>
        <ChipGroup options={MIN_RATING_OPTIONS} value={prefs.minRating} onChange={(v) => set("minRating", v)} />
      </section>

      <section>
        <h3>Era</h3>
        <ChipGroup options={ERA_OPTIONS} value={prefs.eras} multi anyValue="any" onChange={(v) => set("eras", v)} />
      </section>

      <button type="submit" className="primary-button" disabled={!canSubmit}>
        {submitting ? "Saving…" : "I'm ready"}
      </button>
      {!prefs.moods.length && <p className="form-hint">Pick at least one mood to continue.</p>}
    </form>
  );
}
