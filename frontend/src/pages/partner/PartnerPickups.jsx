import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, MapPin, PackageCheck, Truck, X, Upload, ImageIcon } from "lucide-react";
import { partnerClaimPickup, partnerPickups, partnerUpdatePickup, partnerUploadProof } from "../../services/api";
import { PageHead, Badge, Loading } from "../admin/ui";

const SCOPES = [
  ["active", "My active"],
  ["available", "Available"],
  ["completed", "Completed"],
  ["all", "All"],
];

const FINAL_STATUS = [
  ["recycled", "Recycled"],
  ["composted", "Composted"],
  ["returned_to_inventory", "Returned to inventory"],
  ["disposed_safely", "Disposed safely"],
];

const dateTime = (value) => value
  ? new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Not scheduled";

const tomorrowLocal = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function PartnerPickups() {
  const [params, setParams] = useSearchParams();
  const scope = params.get("scope") || "active";
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    setError("");
    partnerPickups(scope).then(setRows).catch(() => {
      setRows([]);
      setError("Pickups could not be loaded. Check your connection and try again.");
    });
  }, [scope]);

  useEffect(load, [load]);

  const claim = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await partnerClaimPickup(modal.row.id, {
        pickup_scheduled_for: new Date(modal.schedule).toISOString(),
        partner_notes: modal.notes,
      });
      setModal(null);
      setParams({ scope: "active" });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.pickup?.[0] || "This pickup could not be claimed.");
    } finally {
      setBusy(false);
    }
  };

  const update = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await partnerUpdatePickup(modal.row.id, { status: modal.status, partner_notes: modal.notes, proof_image: modal.proof || null });
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.status?.[0] || "The pickup status could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHead title="Pickup operations" subtitle="Claim collection requests and record each verified processing stage." />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Pickup filters">
        {SCOPES.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={scope === value} onClick={() => setParams({ scope: value })}
            className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${scope === value ? "bg-teal-600 text-white" : "border border-stone-200 bg-white text-stone-600 hover:border-teal-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!rows ? <Loading /> : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center">
          <Truck className="mx-auto h-9 w-9 text-stone-300" />
          <h2 className="mt-4 font-semibold text-stone-800">No pickups in this view</h2>
          <p className="mt-1 text-sm text-stone-500">New centre requests will appear as soon as they are ready for collection.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((row) => <PickupCard key={row.id} row={row} scope={scope} onOpen={setModal} />)}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}>
          <form onSubmit={modal.type === "claim" ? claim : update} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900">{modal.type === "claim" ? "Schedule pickup" : "Update processing stage"}</h2>
                <p className="mt-1 text-sm text-stone-500">{modal.row.waste_type} · {modal.row.quantity} {modal.row.unit}</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-stone-400 hover:bg-stone-100" aria-label="Close dialog"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 space-y-4">
              {modal.type === "claim" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Pickup date and time</span>
                  <input type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={modal.schedule} onChange={(e) => setModal({ ...modal, schedule: e.target.value })} className="input mt-1.5 min-h-12" required />
                </label>
              ) : modal.row.status === "collected" ? (
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Final outcome</span>
                  <select value={modal.status} onChange={(e) => setModal({ ...modal, status: e.target.value })} className="input mt-1.5 min-h-12">
                    {FINAL_STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              ) : (
                <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-800">Confirm that the material has been collected from the centre.</div>
              )}
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Partner notes <span className="font-normal text-stone-400">(optional)</span></span>
                <textarea value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} rows="3" className="input mt-1.5 resize-none" placeholder="Vehicle, contact, handover, or processing details" />
              </label>
              {modal.type === "status" && (
                <div>
                  <span className="text-sm font-semibold text-stone-700">Collection proof <span className="font-normal text-stone-400">(optional)</span></span>
                  <div className="mt-1.5 flex items-center gap-3">
                    {modal.proof ? (
                      <img src={modal.proof} alt="proof" className="h-14 w-14 rounded-lg object-cover ring-1 ring-stone-200" />
                    ) : (
                      <div className="grid h-14 w-14 place-items-center rounded-lg bg-stone-100 text-stone-400"><ImageIcon className="h-6 w-6" /></div>
                    )}
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                      <Upload className="h-4 w-4" /> {modal.uploading ? "Uploading…" : modal.proof ? "Replace photo" : "Upload photo"}
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files[0]; if (!file) return;
                        setModal((m) => ({ ...m, uploading: true }));
                        try { const r = await partnerUploadProof(file); setModal((m) => ({ ...m, proof: r.url, uploading: false })); }
                        catch { setModal((m) => ({ ...m, uploading: false })); setError("Photo upload failed."); }
                      }} />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-semibold text-stone-600 hover:bg-stone-50">Cancel</button>
              <button disabled={busy} className="min-h-11 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Saving…" : modal.type === "claim" ? "Claim pickup" : "Confirm update"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PickupCard({ row, scope, onOpen }) {
  const available = scope === "available" || (!row.pickup_scheduled_for && row.status === "pickup_assigned");
  const active = ["pickup_assigned", "collected"].includes(row.status) && !available;
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-teal-200 hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><PackageCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-stone-900">{row.waste_type}</h2>
            <Badge status={row.status} />
          </div>
          <div className="mt-1 text-2xl font-extrabold tabular-nums text-stone-900">{row.quantity} <span className="text-sm font-semibold text-stone-400">{row.unit}</span></div>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-xl bg-stone-50 p-3.5 text-sm text-stone-600">
        <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><span><strong className="font-semibold text-stone-800">{row.centre?.name}</strong><br /><span className="text-xs">{row.centre?.address || row.centre?.area}</span></span></div>
        <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 shrink-0 text-stone-400" /><span>{dateTime(row.pickup_scheduled_for)}</span></div>
      </div>
      {(row.notes || row.partner_notes) && <p className="mt-3 text-xs leading-5 text-stone-500">{row.partner_notes || row.notes}</p>}
      {available && (
        <button onClick={() => onOpen({ type: "claim", row, schedule: tomorrowLocal(), notes: "" })} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-semibold text-white hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
          <Truck className="h-4 w-4" /> Claim and schedule
        </button>
      )}
      {active && (
        <button onClick={() => onOpen({ type: "status", row, status: row.status === "collected" ? "recycled" : "collected", notes: row.partner_notes || "" })} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 text-sm font-semibold text-teal-800 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          <CheckCircle2 className="h-4 w-4" /> {row.status === "collected" ? "Record final outcome" : "Mark as collected"}
        </button>
      )}
    </article>
  );
}
