import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Join from "./pages/Join.jsx";
import SessionView from "./pages/SessionView.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join/:sessionId" element={<Join />} />
      <Route path="/session/:sessionId" element={<SessionView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
