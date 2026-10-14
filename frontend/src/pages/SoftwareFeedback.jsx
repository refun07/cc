import { useState } from "react";
import { Link } from "react-router-dom";
import { sendSoftwareFeedback } from "../services/api";
import { useAuthStore } from "../store/authStore";

export default function SoftwareFeedback() {
  const user = useAuthStore((state) => state.user);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await sendSoftwareFeedback({ rating, comment });
      setComment("");
      setMessage("Thank you. Your feedback has been sent.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not send feedback.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
    <h1 className="font-display text-2xl font-bold text-slate-900">Software feedback</h1>
    {!user ? <p className="mt-4 text-slate-600">Please sign in from the header before sending feedback. <Link to="/centres" className="text-brand-700 underline">Browse centres</Link></p> :
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-700">Your rating</div>
          <div className="mt-1 flex gap-1" role="group" aria-label="Software rating">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setRating(value)} aria-label={`${value} stars`} aria-pressed={rating === value} className={`p-1 text-3xl ${value <= rating ? "text-amber-500" : "text-slate-300"}`}>★</button>)}</div>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Your comments
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={5} minLength={10} maxLength={2000} required className="input mt-2 w-full font-normal" placeholder="Tell us what worked and what should improve" />
        </label>
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        <button disabled={busy} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Send feedback</button>
      </form>}
  </main>;
}
