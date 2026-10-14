import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import { fetchMyBookings } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useT } from "../store/langStore";
import { canDownloadRefundApplication, downloadRefundApplication } from "../lib/refundApplication";

export default function MyApplications() {
  const user = useAuthStore((state) => state.user);
  const { lang } = useT();
  const [bookings, setBookings] = useState(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchMyBookings().then((data) => { if (active) setBookings(data); }).catch(() => { if (active) setBookings([]); });
    return () => { active = false; };
  }, [user]);

  const bn = lang === "bn";
  const eligible = (bookings || []).filter(canDownloadRefundApplication);

  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    <h1 className="font-display text-3xl font-bold text-slate-900">{bn ? "আমার আবেদনপত্র" : "My applications"}</h1>
    <p className="mt-2 text-sm text-slate-600">{bn
      ? "পরিশোধিত বুকিংয়ের ফেরতের আবেদনপত্র ডাউনলোড করুন। পূরণ করে সংশ্লিষ্ট অফিসে হাতে জমা দিন। ডাউনলোড করলে অনলাইনে আবেদন জমা হয় না।"
      : "Download a refund application for a paid booking. Fill it in and submit it to the relevant office manually. Downloading does not submit a request."}</p>
    {!user ? <p className="mt-8 text-slate-600">{bn ? "আবেদনপত্র দেখতে সাইন ইন করুন।" : "Sign in to see your applications."}</p>
      : bookings === null ? <p className="mt-8 text-slate-600">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>
      : eligible.length === 0 ? <div className="mt-8 border-t border-slate-200 pt-6 text-slate-600">
        <p>{bn ? "ফেরতের আবেদনপত্রের জন্য কোনো পরিশোধিত বুকিং পাওয়া যায়নি।" : "No paid bookings are available for a refund application."}</p>
        <Link className="mt-3 inline-block font-semibold text-brand-700" to="/my-bookings">{bn ? "আমার বুকিং দেখুন" : "View my bookings"}</Link>
      </div>
      : <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
        {eligible.map((booking) => <div key={booking.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <FileText className="mt-1 h-5 w-5 shrink-0 text-brand-700" />
            <div><Link to={`/booking/${booking.booking_no}`} className="font-semibold text-brand-700 hover:underline">{booking.booking_no}</Link>
              <p className="text-sm text-slate-700">{booking.centre?.name}</p>
              <p className="text-xs text-slate-500">{booking.event_date}</p>
            </div>
          </div>
          <button type="button" onClick={() => downloadRefundApplication(booking)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Download className="h-4 w-4" /> {bn ? "আবেদনপত্র ডাউনলোড" : "Download application"}
          </button>
        </div>)}
      </div>}
  </div>;
}
