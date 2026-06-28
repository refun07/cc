import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, CalendarCheck, Wallet, Boxes, Recycle, BadgeDollarSign, Info } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../services/api";

const ICONS = {
  booking: CalendarCheck, payment: Wallet, inventory: Boxes, waste: Recycle, payroll: BadgeDollarSign, system: Info,
};
const TINTS = {
  booking: "bg-blue-50 text-blue-600", payment: "bg-emerald-50 text-emerald-600",
  inventory: "bg-amber-50 text-amber-600", waste: "bg-teal-50 text-teal-600",
  payroll: "bg-violet-50 text-violet-600", system: "bg-slate-100 text-slate-500",
};

function ago(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell({ dark = false }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ data: [], unread: 0 });
  const ref = useRef(null);
  const nav = useNavigate();

  const load = () => getNotifications().then(setData).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const openItem = async (n) => {
    if (!n.read_at) { await markNotificationRead(n.id); load(); }
    if (n.link) { setOpen(false); nav(n.link); }
  };
  const readAll = async () => { await markAllNotificationsRead(); load(); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className={`relative grid h-9 w-9 place-items-center rounded-lg border transition ${dark ? "border-white/15 text-white/80 hover:bg-white/10" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
      >
        <Bell className="h-4.5 w-4.5" />
        {data.unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold text-slate-900">Notifications</span>
              {data.unread > 0 && (
                <button onClick={readAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data.data.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">You're all caught up.</div>
              ) : data.data.map((n) => {
                const Icon = ICONS[n.type] || Info;
                return (
                  <button key={n.id} onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${n.read_at ? "" : "bg-brand-50/40"}`}>
                    <span className={`mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${TINTS[n.type] || TINTS.system}`}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-slate-400">{ago(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
