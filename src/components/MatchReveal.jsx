import { motion } from "framer-motion";
import RatingPrompt from "./RatingPrompt.jsx";

// The one screen the whole app is building toward -- both partners see this
// at the same instant (driven by the realtime subscription on sessions.match
// in SessionView), so it needs to read as an event, not a search result.
export default function MatchReveal({ match, onRate }) {
  return (
    <motion.div
      className="match-reveal"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <motion.p
        className="match-banner"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        You both said yes 🎉
      </motion.p>

      <div className="match-card">
        {match.posterUrl && <img src={match.posterUrl} alt="" className="match-poster" />}
        <div className="match-details">
          <h1>
            {match.title} <span className="year">({match.year || "—"})</span>
          </h1>
          <div className="meta-row">
            <span className="pill rating">★ {match.displayRating != null ? match.displayRating.toFixed(1) : "—"}</span>
            {match.runtimeMinutes && <span className="pill">{match.runtimeMinutes} min</span>}
            <span className="pill">{match.mediaType === "tv" ? "Series" : "Movie"}</span>
          </div>
          <p className="synopsis">{match.synopsis}</p>

          <h3>Watch it now on</h3>
          {match.platforms?.length ? (
            <div className="platform-list">
              {match.platforms.map((p) => (
                <a key={p.service} className="platform-link" href={p.link || "#"} target="_blank" rel="noreferrer">
                  {p.service}
                </a>
              ))}
            </div>
          ) : (
            <p className="form-hint">Not currently streaming on a tracked Indian service.</p>
          )}

          <RatingPrompt onRate={onRate} />
        </div>
      </div>
    </motion.div>
  );
}
