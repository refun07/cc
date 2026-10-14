import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getBookingSoftwareFeedback, sendSoftwareFeedback } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import { useT } from "../store/langStore";

export default function BookingSoftwareFeedback({ bookingNo }) {
  const user = useAuthStore((state) => state.user);
  const { lang } = useT();
  const tr = (en, bn) => lang === "bn" ? bn : en;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role !== "customer") return;
    let active = true;
    setLoading(true);
    setRating(0);
    setComment("");
    setSubmitted(false);
    getBookingSoftwareFeedback(bookingNo).then((feedback) => {
      if (!active) return;
      setRating(feedback?.rating ?? 0);
      setComment(feedback?.comment ?? "");
      setSubmitted(Boolean(feedback));
    }).catch((error) => {
      if (active) toast.error(error.response?.data?.message || "Could not load feedback.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingNo, user?.id, user?.role]);

  if (user?.role !== "customer") return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!rating || busy) return;
    setBusy(true);
    try {
      await sendSoftwareFeedback({ booking_no: bookingNo, rating, comment: comment.trim() || null });
      setSubmitted(true);
      toast.success(tr("Thank you for your feedback.", "আপনার মতামতের জন্য ধন্যবাদ।"));
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send feedback.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="mt-6 border-y border-brand-200 bg-brand-50/50 px-4 py-5 sm:px-6" aria-labelledby="booking-feedback-heading">
    <h2 id="booking-feedback-heading" className="font-display text-xl font-bold text-slate-900">{tr("Feedback about the software", "সফটওয়্যার সম্পর্কে মতামত")}</h2>
    {submitted && <p role="status" className="mt-1 text-sm font-medium text-brand-700">{tr("Feedback saved. You can update it below.", "মতামত সংরক্ষিত হয়েছে। নিচে পরিবর্তন করতে পারবেন।")}</p>}
    <form onSubmit={submit} className="mt-4 space-y-4">
      <fieldset><legend className="text-sm font-semibold text-slate-700">{tr("Your rating", "আপনার রেটিং")}</legend><div className="mt-1 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} disabled={loading || busy}
          aria-label={tr(`${value} star${value === 1 ? "" : "s"}`, `${value.toLocaleString("bn-BD")} তারা`)} aria-pressed={rating === value}
          className="grid h-11 w-11 place-items-center rounded-lg text-amber-500 transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50">
          <Star className="h-7 w-7" fill={value <= rating ? "currentColor" : "none"} />
        </button>)}
      </div></fieldset>
      <label className="block text-sm font-semibold text-slate-700">{tr("Your comments (optional)", "আপনার মন্তব্য (ঐচ্ছিক)")}
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} rows={3}
          disabled={loading || busy} className="input mt-2 w-full font-normal" placeholder={tr("Tell us what worked and what should improve", "কী ভালো লেগেছে এবং কী উন্নতি প্রয়োজন জানান")} />
      </label>
      <button disabled={loading || busy || !rating} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? tr("Sending...", "পাঠানো হচ্ছে…") : submitted ? tr("Update feedback", "মতামত পরিবর্তন করুন") : tr("Send feedback", "মতামত পাঠান")}
      </button>
    </form>
  </section>;
}
