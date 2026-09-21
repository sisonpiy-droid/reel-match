import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PreferenceForm from "../components/PreferenceForm.jsx";
import Loading from "../components/Loading.jsx";
import Logo from "../components/Logo.jsx";
import { getSession, getParticipants, submitPreferences } from "../lib/session.js";
import { getMySlot, setMySlot } from "../lib/mySlot.js";

export default function Join() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | ready | full | not_found
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const existingSlot = getMySlot(sessionId);
    if (existingSlot) {
      navigate(`/session/${sessionId}`);
      return;
    }
    (async () => {
      try {
        await getSession(sessionId);
        const participants = await getParticipants(sessionId);
        if (participants.some((p) => p.slot === "B")) {
          setStatus("full");
          return;
        }
        setStatus("ready");
      } catch {
        setStatus("not_found");
      }
    })();
  }, [sessionId, navigate]);

  async function handleSubmit(preferences) {
    setSubmitting(true);
    setError(null);
    try {
      await submitPreferences(sessionId, "B", preferences);
      setMySlot(sessionId, "B");
      navigate(`/session/${sessionId}`);
    } catch (e) {
      setError(e.message || "Something went wrong");
      setSubmitting(false);
    }
  }

  if (status === "loading") return <Loading title="Finding your invite…" />;
  if (status === "not_found") {
    return (
      <div className="screen">
        <div className="status-card">
          <Logo />
          <h2>Can't find that session</h2>
          <p>The link might be wrong, or it's expired. Ask your partner to send it again.</p>
        </div>
      </div>
    );
  }
  if (status === "full") {
    return (
      <div className="screen">
        <div className="status-card">
          <Logo />
          <h2>This one's already got two people</h2>
          <p>Looks like your partner already joined from another device. Start a new session if that wasn't you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="app-header">
        <Logo />
        <h1>You've been invited</h1>
        <p>Set your own mood — you won't see their answers, and they won't see yours.</p>
      </header>
      <PreferenceForm onSubmit={handleSubmit} submitting={submitting} />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
