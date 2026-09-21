import { useEffect, useState } from "react";
import { fetchPlatforms, finalizeMatch } from "../lib/api.js";
import { fallbackLinks } from "../lib/fallbackLinks.js";

function rankTop5(swipes, titleCatalog) {
  const rightBySlot = new Map(); // titleId -> Set(slot)
  for (const s of swipes) {
    if (s.direction !== "right") continue;
    if (!rightBySlot.has(s.title_id)) rightBySlot.set(s.title_id, new Set());
    rightBySlot.get(s.title_id).add(s.slot);
  }

  return [...rightBySlot.entries()]
    .map(([titleId, slots]) => ({ card: titleCatalog[titleId], score: slots.size }))
    .filter((row) => row.card)
    .sort((a, b) => b.score - a.score || (b.card.displayRating ?? 0) - (a.card.displayRating ?? 0))
    .slice(0, 5);
}

// Neither round produced a match. Rank everything either partner liked by
// how many of them liked it, show where to watch each, and let the couple
// make the final call together -- the product explicitly stops short of
// forcing a pick here.
export default function TopFive({ sessionId, swipes, titleCatalog, picking, onPick }) {
  const ranked = rankTop5(swipes, titleCatalog);
  const [platforms, setPlatforms] = useState({});

  useEffect(() => {
    if (!ranked.length) return;
    fetchPlatforms(sessionId, ranked.map((r) => r.card.id))
      .then((res) => setPlatforms(res.platforms))
      .catch(() => {});
  }, [sessionId, ranked.map((r) => r.card.id).join(",")]);

  async function pick(titleId) {
    onPick(titleId);
    await finalizeMatch(sessionId, titleId);
  }

  if (!ranked.length) {
    return (
      <div className="top-five">
        <h2>No overlap this time</h2>
        <p>Neither of you swiped right on anything in common. Try again with different moods?</p>
      </div>
    );
  }

  return (
    <div className="top-five">
      <h2>Still no match — but you're both close</h2>
      <p>Here's what got the most love. Pick one together.</p>
      <div className="top-five-list">
        {ranked.map(({ card, score }) => (
          <div key={card.id} className="top-five-row">
            {card.posterUrl && <img src={card.posterUrl} alt="" className="top-five-poster" />}
            <div className="top-five-info">
              <h3>
                {card.title} <span className="year">({card.year || "—"})</span>
              </h3>
              <div className="meta-row">
                <span className="pill rating">★ {card.displayRating != null ? card.displayRating.toFixed(1) : "—"}</span>
                <span className="pill">{score === 2 ? "Both liked" : "One of you liked"}</span>
              </div>
              {platforms[card.id]?.length ? (
                <div className="platform-list">
                  {platforms[card.id].map((p) => (
                    <span key={p.service} className="platform-chip">{p.service}</span>
                  ))}
                </div>
              ) : platforms[card.id] ? (
                // Loaded, and genuinely empty -- not "not tracked" but
                // "hasn't loaded yet" (that's `undefined`, handled by not
                // rendering anything below).
                <div className="platform-list">
                  {fallbackLinks(card.title, card.year).map((l) => (
                    <a key={l.label} className="platform-chip" href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>
                  ))}
                </div>
              ) : null}
              <button type="button" className="primary-button" disabled={picking} onClick={() => pick(card.id)}>
                We'll watch this
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
