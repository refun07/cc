import { useEffect, useState } from "react";
import { Star, Check, Ban, ExternalLink } from "lucide-react";
import { adminCentres, adminSetCentreStatus } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, Card, Table, Badge, Loading } from "./ui";

export default function AdminCentres() {
  const [centres, setCentres] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => adminCentres().then(setCentres).catch(() => setCentres([]));
  useEffect(() => { load(); }, []);

  const setStatus = async (c, status) => {
    setBusyId(c.id);
    try {
      await adminSetCentreStatus(c.id, status);
      setCentres((list) => list.map((x) => (x.id === c.id ? { ...x, status, is_verified: status === "active" ? true : x.is_verified } : x)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHead title="Community centres" subtitle="Approve, suspend and monitor every venue on the marketplace." />
      <Card>
        {!centres ? <Loading /> : (
          <Table head={["Centre", "Area", "Capacity", "Price (½ day)", "Bookings", "Rating", "Status", "Actions"]}>
            {centres.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <img src={c.cover_image} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    <a href={`/centres/${c.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-brand-700">
                      {c.name} <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-600">{c.area}</td>
                <td className="px-5 py-3 tabular-nums">{c.capacity}</td>
                <td className="px-5 py-3 tabular-nums">{taka(c.half_day_price)}</td>
                <td className="px-5 py-3 tabular-nums">{c.bookings_count}</td>
                <td className="px-5 py-3"><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{c.rating.toFixed(1)}</span></td>
                <td className="px-5 py-3"><Badge status={c.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    {c.status !== "active" && (
                      <button disabled={busyId === c.id} onClick={() => setStatus(c, "active")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {c.status !== "suspended" && (
                      <button disabled={busyId === c.id} onClick={() => setStatus(c, "suspended")}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                        <Ban className="h-3.5 w-3.5" /> Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
