import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, ArrowRight, CalendarCheck } from "lucide-react";
import { fetchMyBookings } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { taka, sessionLabel } from "../lib/format";

const STATUS_STYLES = {
  confirmed: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  payment_pending: "bg-amber-100 text-amber-700",
  pending_review: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-slate-200 text-slate-700",
};

export default function MyBookings() {
  const user = useAuthStore((s) => s.user);
  const [bookings, setBookings] = useState(null);

  useEffect(() => {
    if (user) fetchMyBookings().then(setBookings).catch(() => setBookings([]));
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-slate-500">
        Please sign in to view your bookings.
        <Link to="/centres" className="mt-4 block font-semibold text-brand-700">Browse centres →</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
      <h1 className="font-display text-3xl font-extrabold text-slate-900">My bookings</h1>
      <p className="mt-1 text-slate-500">Hi {user.name.split(" ")[0]}, here are your event bookings.</p>

      {bookings === null ? (
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <CalendarCheck className="h-7 w-7" />
          </div>
          <p className="mt-4 font-semibold text-slate-700">No bookings yet</p>
          <Link to="/centres" className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Book a centre
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {bookings.map((b) => (
            <Link
              key={b.id}
              to={`/booking/${b.booking_no}`}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{b.booking_no}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[b.status] || "bg-slate-100 text-slate-600"}`}>
                    {b.status.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="mt-1 font-bold text-slate-900">{b.centre.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {b.centre.area}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {b.event_date}{b.date_count > 1 ? ` +${b.date_count - 1} dates` : ""}</span>
                  <span>{new Set((b.booking_dates || []).map((slot) => slot.session_type)).size > 1 ? "Mixed sessions" : sessionLabel(b.session_type)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="text-right">
                  <div className="text-lg font-extrabold text-slate-900">{taka(b.total_amount)}</div>
                  {b.due_amount > 0 && <div className="text-xs text-amber-600">Due {taka(b.due_amount)}</div>}
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-600" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
