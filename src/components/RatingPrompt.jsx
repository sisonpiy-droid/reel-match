import { useState } from "react";

export default function RatingPrompt({ onRate }) {
  const [sent, setSent] = useState(false);

  if (sent) return <p className="rating-thanks">Saved — future picks will remember this one.</p>;

  return (
    <div className="rating-prompt">
      <p>Watched it? Rate it for next time:</p>
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="star-btn"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => {
              onRate(n);
              setSent(true);
            }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
