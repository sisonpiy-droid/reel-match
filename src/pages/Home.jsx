import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PreferenceForm from "../components/PreferenceForm.jsx";
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
        <h1>Reel Match</h1>
        <p>Set your mood. We'll find something you'll both actually watch tonight.</p>
      </header>
      <PreferenceForm onSubmit={handleSubmit} submitting={submitting} />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
