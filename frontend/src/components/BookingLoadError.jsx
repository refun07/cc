import { useState } from "react";
import { Link } from "react-router-dom";
import AuthModal from "./AuthModal";

export default function BookingLoadError({ status, subject, onRetry }) {
  const [authOpen, setAuthOpen] = useState(false);
  const message = status === 404 ? `${subject} not found.`
    : status === 401 ? "Please sign in to view this booking."
      : status === 403 ? "Your account does not have access to this booking."
        : `Could not load ${subject.toLowerCase()}. Please try again.`;
  return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-slate-600">
    <p role="alert">{message}</p>
    <div className="mt-4 flex flex-wrap justify-center gap-3">
      {status === 401 && <button type="button" onClick={() => setAuthOpen(true)} className="min-h-11 rounded-lg bg-brand-600 px-4 text-white">Sign in</button>}
      <button type="button" onClick={onRetry} className="min-h-11 rounded-lg border border-slate-300 px-4">Retry</button>
      <Link to="/centres" className="inline-flex min-h-11 items-center px-4 font-semibold text-brand-700">Browse centres</Link>
    </div>
    <AuthModal open={authOpen} defaultMode="login" onClose={() => { setAuthOpen(false); onRetry(); }} />
  </div>;
}
