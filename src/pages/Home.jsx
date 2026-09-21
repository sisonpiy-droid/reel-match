import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PreferenceForm from "../components/PreferenceForm.jsx";
import Logo from "../components/Logo.jsx";
import { createSession, submitPreferences } from "../lib/session.js";
import { getOrCreateCoupleId, ensureCoupleRow } from "../lib/coupleId.js";
import { setMySlot } from "../lib/mySlot.js";

export default function Home() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(preferences) {
    setSubmitting(true);
    setError(null);
    try {
      const coupleId = getOrCreateCoupleId();
      await ensureCoupleRow(coupleId);
      const session = await createSession(coupleId);
      await submitPreferences(session.id, "A", preferences);
      setMySlot(session.id, "A");
      navigate(`/session/${session.id}`);
    } catch (e) {
      setError(e.message || "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <header className="app-header">
        <Logo />
        <h1>Stop scrolling. Start watching.</h1>
        <p>Set your mood — we'll shortlist 30 titles, you both swipe, and we'll tell you exactly where to stream the one you agree on.</p>
      </header>
      <PreferenceForm onSubmit={handleSubmit} submitting={submitting} />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
