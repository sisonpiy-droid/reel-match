import SwipeCard from "./SwipeCard.jsx";

// `cards` is this partner's already-shuffled full deck; `index` is how many
// they've gotten through. Parent owns index/state so it can also track
// match detection and round completion from the same swipe events.
export default function SwipeDeck({ cards, index, onSwipe, waitingMessage }) {
  const visible = cards.slice(index, index + 2);

  if (!visible.length) {
    return (
      <div className="swipe-done">
        <div className="spinner" aria-hidden="true" />
        <p>{waitingMessage}</p>
      </div>
    );
  }

  return (
    <div className="swipe-deck">
      {visible.map((card, i) => (
        <SwipeCard key={card.id} card={card} stackDepth={i} onSwipe={i === 0 ? (dir) => onSwipe(card.id, dir) : undefined} />
      ))}
      <p className="deck-progress">
        {index + 1} of {cards.length}
      </p>
    </div>
  );
}
