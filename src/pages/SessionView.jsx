import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loading from "../components/Loading.jsx";
import QRShare from "../components/QRShare.jsx";
import SwipeDeck from "../components/SwipeDeck.jsx";
import MatchReveal from "../components/MatchReveal.jsx";
import TopFive from "../components/TopFive.jsx";
import {
  getSession,
  subscribeToSession,
  getParticipants,
  subscribeToParticipants,
  claimTransition,
  getSwipes,
  getAllSwipes,
  subscribeToSwipes,
  recordSwipe,
  submitRating,
} from "../lib/session.js";
import { generatePool, refinePool, finalizeMatch } from "../lib/api.js";
import { getMySlot, otherSlot } from "../lib/mySlot.js";
import { shuffle } from "../lib/shuffle.js";

const LOADING_COPY = {
  waiting_b_self: { title: "Waiting for your partner…", subtitle: "Share the QR code or link below." },
  waiting_b_other: { title: "Syncing up…", subtitle: "Just a second." },
  generating_1: { title: "Reading your moods…", subtitle: "Picking 30 titles you'll both like." },
  generating_2: { title: "Trying again…", subtitle: "Leaning into what you both actually swiped right on." },
};

export default function SessionView() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const mySlot = getMySlot(sessionId);

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [swipes, setSwipes] = useState([]);
  const [allSwipes, setAllSwipes] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const triedTransition = useRef(new Set()); // dedupe keys like "generate", "refine:2", "finalize"

  useEffect(() => {
    if (!mySlot) {
      navigate(`/join/${sessionId}`);
      return;
    }
    getSession(sessionId)
      .then(setSession)
      .catch((e) => setLoadError(e.message));
    getParticipants(sessionId).then(setParticipants);
  }, [sessionId, mySlot, navigate]);

  useEffect(() => {
    if (!mySlot) return;
    const unsubSession = subscribeToSession(sessionId, setSession);
    const unsubParticipants = subscribeToParticipants(sessionId, () => {
      getParticipants(sessionId).then(setParticipants);
    });
    return () => {
      unsubSession();
      unsubParticipants();
    };
  }, [sessionId, mySlot]);

  // --- Both partners in: claim the transition to pool generation ----------
  useEffect(() => {
    if (!session || participants.length < 2) return;
    if (session.status !== "waiting_b" && session.status !== "collecting") return;
    const key = "generate";
    if (triedTransition.current.has(key)) return;
    triedTransition.current.add(key);

    claimTransition(sessionId, session.status, { status: "generating" })
      .then((won) => {
        if (won) return generatePool(sessionId);
      })
      .catch((e) => {
        triedTransition.current.delete(key);
        setLoadError(e.message);
      });
  }, [session?.status, participants.length, sessionId]);

  // --- Load + subscribe to this round's swipes -----------------------------
  useEffect(() => {
    if (!session || session.status !== "swiping") return;
    let unsub;
    getSwipes(sessionId, session.round).then((rows) => {
      setSwipes(rows);
      unsub = subscribeToSwipes(sessionId, session.round, (row) => {
        setSwipes((prev) => (prev.some((s) => s.slot === row.slot && s.title_id === row.title_id) ? prev : [...prev, row]));
      });
    });
    return () => unsub?.();
  }, [sessionId, session?.status, session?.round]);

  // Keyed on round *and* pool length, not just round: pool goes from empty
  // to populated within the same round number (generate-pool writes the
  // titles after the row already exists at round 1), so round alone never
  // changes when that happens and this memo would keep returning the stale
  // empty deck from before generation finished.
  const shuffledPool = useMemo(() => (session?.pool ? shuffle(session.pool) : []), [session?.round, session?.pool?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const mySwipes = useMemo(() => swipes.filter((s) => s.slot === mySlot), [swipes, mySlot]);
  const theirSwipes = useMemo(() => swipes.filter((s) => s.slot === otherSlot(mySlot)), [swipes, mySlot]);
  const matchCandidate = useMemo(() => {
    const theirRight = new Set(theirSwipes.filter((s) => s.direction === "right").map((s) => s.title_id));
    return mySwipes.find((s) => s.direction === "right" && theirRight.has(s.title_id))?.title_id;
  }, [mySwipes, theirSwipes]);

  // --- A match was found: lock it in (safe to race, see finalize-match.js) -
  useEffect(() => {
    if (!matchCandidate || session?.status !== "swiping") return;
    const key = "finalize";
    if (triedTransition.current.has(key)) return;
    triedTransition.current.add(key);
    finalizeMatch(sessionId, matchCandidate).catch((e) => {
      triedTransition.current.delete(key);
      setLoadError(e.message);
    });
  }, [matchCandidate, session?.status, sessionId]);

  // --- Both finished this round with no match: advance ---------------------
  useEffect(() => {
    if (!session || session.status !== "swiping" || matchCandidate) return;
    const poolSize = session.pool?.length || 0;
    if (!poolSize || mySwipes.length < poolSize || theirSwipes.length < poolSize) return;

    const key = `round-done:${session.round}`;
    if (triedTransition.current.has(key)) return;
    triedTransition.current.add(key);

    if (session.round < 2) {
      claimTransition(sessionId, "swiping", { status: "generating" })
        .then((won) => won && refinePool(sessionId))
        .catch((e) => {
          triedTransition.current.delete(key);
          setLoadError(e.message);
        });
    } else {
      claimTransition(sessionId, "swiping", { status: "no_match_final" }).catch((e) => {
        triedTransition.current.delete(key);
        setLoadError(e.message);
      });
    }
  }, [session, mySwipes.length, theirSwipes.length, matchCandidate, sessionId]);

  useEffect(() => {
    if (session?.status === "no_match_final") getAllSwipes(sessionId).then(setAllSwipes);
  }, [session?.status, sessionId]);

  function handleSwipe(titleId, direction) {
    setSwipes((prev) => [...prev, { slot: mySlot, title_id: titleId, direction }]);
    recordSwipe(sessionId, mySlot, session.round, titleId, direction).catch((e) => setLoadError(e.message));
  }

  if (loadError) return <div className="screen"><h2>Something went wrong</h2><p>{loadError}</p></div>;
  if (!session) return <Loading title="Loading your session…" />;

  switch (session.status) {
    case "waiting_b":
    case "collecting": {
      if (mySlot === "A") {
        const copy = LOADING_COPY.waiting_b_self;
        return (
          <div className="screen">
            <header className="app-header"><h1>{copy.title}</h1><p>{copy.subtitle}</p></header>
            <QRShare url={`${window.location.origin}/join/${sessionId}`} />
          </div>
        );
      }
      return <Loading {...toLoadingProps(LOADING_COPY.waiting_b_other)} />;
    }

    case "generating": {
      const copy = session.round >= 2 ? LOADING_COPY.generating_2 : LOADING_COPY.generating_1;
      return <Loading {...toLoadingProps(copy)} />;
    }

    case "swiping":
      return (
        <div className="screen swipe-screen">
          <SwipeDeck
            cards={shuffledPool}
            index={mySwipes.length}
            onSwipe={handleSwipe}
            waitingMessage={
              theirSwipes.length >= (session.pool?.length || 0)
                ? "Finding a match…"
                : "You're done for this round — waiting for your partner…"
            }
          />
        </div>
      );

    case "matched":
      return (
        <div className="screen">
          <MatchReveal match={session.match} onRate={(rating) => submitRating(sessionId, mySlot, session.match.id, rating)} />
        </div>
      );

    case "no_match_final":
      if (!allSwipes) return <Loading title="Tallying it up…" />;
      return (
        <div className="screen">
          <TopFive
            sessionId={sessionId}
            swipes={allSwipes}
            titleCatalog={session.title_catalog || {}}
            picking={false}
            onPick={() => {}}
          />
        </div>
      );

    default:
      return <Loading title="Loading…" />;
  }
}

function toLoadingProps(copy) {
  return { title: copy.title, subtitle: copy.subtitle };
}
