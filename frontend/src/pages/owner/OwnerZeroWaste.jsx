import { useEffect, useState } from "react";
import { Truck, X } from "lucide-react";
import CrudPanel from "./CrudPanel";
import { Badge } from "../admin/ui";
import { ownerWastePartners, ownerAssignWaste } from "../../services/api";
import { toast } from "../../store/toastStore";

const STATUSES = [
  "sorting_required", "compost_pending", "recycling_assigned", "pickup_assigned",
  "collected", "recycled", "composted", "returned_to_inventory", "disposed_safely",
];

function AssignModal({ stream, onClose }) {
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (stream) ownerWastePartners().then(setPartners).catch(() => setPartners([])); }, [stream]);
  if (!stream) return null;

  const submit = async () => {
    if (!partnerId) return toast.error("Choose a partner.");
    if (!date) return toast.error("Choose a pickup time.");
    setBusy(true);
    try {
      const r = await ownerAssignWaste(stream.id, { partner_id: Number(partnerId), pickup_scheduled_for: new Date(date).toISOString() });
      toast.success(r.message); onClose(true);
    } catch (e) { toast.error(e.response?.data?.message || "Could not assign."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-slate-900"><Truck className="h-5 w-5 text-brand-600" /> Assign pickup</h2>
          <button onClick={() => onClose(false)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm text-slate-500">{stream.waste_type} · {stream.quantity} {stream.unit}</p>
        <div className="mt-4 space-y-3">
          <label className="block"><span className="text-xs font-semibold text-slate-500">Zero waste partner</span>
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="input mt-1">
              <option value="">Select partner…</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}
            </select>
          </label>
          <label className="block"><span className="text-xs font-semibold text-slate-500">Scheduled pickup</span>
            <input type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} className="input mt-1" /></label>
          <button onClick={submit} disabled={busy || !partnerId || !date} className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Assigning…" : "Assign to partner"}</button>
        </div>
      </div>
    </div>
  );
}

export default function OwnerZeroWaste() {
  const [assignFor, setAssignFor] = useState(null);
  const [reloadFn, setReloadFn] = useState(null);

  return (
    <>
      <CrudPanel
        resource="waste"
        title="Zero Waste Management"
        subtitle="Log event waste streams, assign verified partners, and track recycling, composting or reuse."
        addLabel="Log waste"
        searchPlaceholder="Search waste…" searchKeys={["waste_type", "status", "notes"]}
        defaults={{ waste_type: "Organic food waste", quantity: 0, unit: "kg", status: "sorting_required", notes: "" }}
        rowActions={(row, reload) => (
          <button onClick={() => { setAssignFor(row); setReloadFn(() => reload); }}
            className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100">
            <Truck className="h-3.5 w-3.5" /> Assign
          </button>
        )}
        columns={[
          { key: "waste_type", label: "Waste type", render: (r) => <span className="font-medium text-slate-800">{r.waste_type}</span> },
          { key: "quantity", label: "Quantity", render: (r) => <span className="tabular-nums">{r.quantity} {r.unit}</span> },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          { key: "proof_image", label: "Proof", render: (r) => r.proof_image ? <a href={r.proof_image} target="_blank" rel="noreferrer"><img src={r.proof_image} alt="proof" className="h-9 w-9 rounded-md object-cover ring-1 ring-slate-200" /></a> : <span className="text-slate-300">—</span> },
        ]}
        fields={[
          { key: "waste_type", label: "Waste type", type: "select", required: true, options: ["Organic food waste", "Plastic bottles", "Paper plates and cups", "Mixed event waste", "Reusable décor items", "Cardboard packaging", "Glass bottles", "Metal cans"] },
          { key: "quantity", label: "Quantity", type: "number", required: true },
          { key: "unit", label: "Unit", type: "select", options: ["kg", "pcs", "bags"] },
          { key: "status", label: "Status", type: "select", options: STATUSES },
          { key: "notes", label: "Notes", type: "textarea", full: true },
        ]}
      />
      <AssignModal stream={assignFor} onClose={() => { reloadFn?.(); setAssignFor(null); }} />
    </>
  );
}
