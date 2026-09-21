import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useState } from "react";

const THRESHOLD = 100;
const FLY_DISTANCE = 700;

// Only the top card of the stack is draggable/tappable (stackDepth 0);
// cards behind it are inert, slightly scaled-down previews for depth.
export default function SwipeCard({ card, stackDepth, onSwipe }) {
  const isTop = stackDepth === 0;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);
  const [flying, setFlying] = useState(false);

  // Drag past the threshold or tap a button -- either way the card commits
  // to a direction and flies the rest of the way off-screen before the
  // parent is told (so removal from the stack is never visible mid-flight).
  function commit(direction) {
    if (flying) return;
    setFlying(true);
    animate(x, direction === "right" ? FLY_DISTANCE : -FLY_DISTANCE, {
      type: "spring",
      stiffness: 260,
      damping: 26,
      onComplete: () => onSwipe(direction),
    });
  }

  function handleDragEnd(_, info) {
    if (info.offset.x > THRESHOLD) commit("right");
    else if (info.offset.x < -THRESHOLD) commit("left");
  }

  return (
    <motion.div
      className="swipe-card"
      style={{ zIndex: 10 - stackDepth, x: isTop ? x : 0, rotate: isTop ? rotate : 0 }}
      animate={{ scale: isTop ? 1 : 0.94, y: isTop ? 0 : 14 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      drag={isTop && !flying ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
    >
      <div className="poster-wrap">
        {card.posterUrl ? <img src={card.posterUrl} alt="" className="poster" /> : <div className="poster poster-fallback" />}
        <div className="card-gradient" />
        {isTop && (
          <>
            <motion.div className="badge badge-like" style={{ opacity: likeOpacity }}>LIKE</motion.div>
            <motion.div className="badge badge-nope" style={{ opacity: nopeOpacity }}>NOPE</motion.div>
            <div className="tap-buttons">
              <button type="button" className="tap-btn tap-nope" onClick={() => commit("left")} aria-label="Pass">
                ✕
              </button>
              <button type="button" className="tap-btn tap-like" onClick={() => commit("right")} aria-label="Like">
                ♥
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card-info">
        <h2>
          {card.title} <span className="year">({card.year || "—"})</span>
        </h2>
        <div className="meta-row">
          <span className="pill rating">★ {card.displayRating != null ? card.displayRating.toFixed(1) : "—"}</span>
          {card.runtimeMinutes && <span className="pill">{card.runtimeMinutes} min</span>}
          <span className="pill">{card.mediaType === "tv" ? "Series" : "Movie"}</span>
        </div>
        <p className="synopsis">{card.synopsis}</p>
      </div>
    </motion.div>
  );
}
