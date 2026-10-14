import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Pencil, Printer, MapPin, CalendarDays, Clock, Users, Phone, Mail, Tag, Utensils, Save, Wallet, CheckCircle2,
  ImagePlus, StickyNote, Trash2,
} from "lucide-react";
import { Undo2 } from "lucide-react";
import { ownerUpdateBooking, recordOfflinePayment, ownerUpload, ownerUpdateBookingAttachments, ownerRefundBooking } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { Badge } from "../admin/ui";
import { toast } from "../../store/toastStore";
import Invoice from "../../components/Invoice";

const PAY_METHODS = [
  { id: "Bank Transfer", color: "#475569" },
  { id: "Cash", color: "#0F172A" },
];

export default function OwnerBookingDetailModal({ booking, centre, onClose, onUpdated }) {
  const [mode, setMode] = useState("view"); // view | edit
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payAmount, setPayAmount] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundKey, setRefundKey] = useState(() => crypto.randomUUID());
  const [collectionKey, setCollectionKey] = useState(() => crypto.randomUUID());
  const [uploading, setUploading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteEditing, setNoteEditing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const invoiceRef = useRef(null);

  useEffect(() => {
    if (booking) {
      setMode("view");
      setForm({
        customer_name: booking.customer_name || "",
        customer_phone: booking.customer_phone || "",
        customer_email: booking.customer_email || "",
        guest_count: booking.guest_count || 1,
        event_type: booking.event_type || "",
        event_manager_name: booking.event_manager_name || "",
        event_manager_phone: booking.event_manager_phone || "",
        adjustment_amount: booking.adjustment_amount || 0,
        adjustment_reason: booking.adjustment_reason || "",
      });
      setNoteDraft(booking.notes || "");
      setNoteEditing(false);
    }
  }, [booking]);

  if (!booking || !form) return null;

  const editable = !["cancelled", "completed", "refunded"].includes(booking.status);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await ownerUpdateBooking(booking.booking_no, {
        ...form,
        guest_count: Number(form.guest_count) || 1,
        adjustment_amount: Number(form.adjustment_amount) || 0,
      });
      onUpdated(updated);
      setMode("view");
      toast.success("Booking updated.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not update booking.");
    } finally {
      setSaving(false);
    }
  };

  const attachments = booking.attachments || [];

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await ownerUpload(file);
      const updated = await ownerUpdateBookingAttachments(booking.booking_no, { attachments: [...attachments, url] });
      onUpdated(updated);
      toast.success("Image attached.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not upload image.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (url) => {
    try {
      const updated = await ownerUpdateBookingAttachments(booking.booking_no, { attachments: attachments.filter((u) => u !== url) });
      onUpdated(updated);
    } catch (err) {
      toast.error("Could not remove image.");
    }
  };

  const saveNote = async () => {
    setSavingNote(true);
    try {
      const updated = await ownerUpdateBookingAttachments(booking.booking_no, { attachments, notes: noteDraft });
      onUpdated(updated);
      setNoteEditing(false);
      toast.success("Note saved.");
    } catch (err) {
      toast.error("Could not save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const refundable = Math.max(Number(booking.refundable_amount ?? booking.paid_amount), 0);
  const doRefund = async () => {
    const amt = Number(refundAmount);
    if (!(amt > 0)) return toast.error("Enter a refund amount.");
    if (amt > refundable) return toast.error(`Max refundable is ${taka(refundable)}.`);
    setRefunding(true);
    try {
      const updated = await ownerRefundBooking(booking.booking_no, { amount: amt, reason: refundReason || null, request_key: refundKey });
      setRefundKey(crypto.randomUUID());
      onUpdated(updated);
      setRefundOpen(false); setRefundAmount(""); setRefundReason("");
      toast.success(`Refund of ${taka(amt)} issued.`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not issue refund.");
    } finally {
      setRefunding(false);
    }
  };

  const collectPayment = async () => {
    const custom = Number(payAmount);
    if (payAmount !== "" && (!Number.isFinite(custom) || custom <= 0 || custom > Number(booking.due_amount))) {
      return toast.error("Payment must be greater than zero and cannot exceed the amount due.");
    }
    const useCustom = payAmount !== "" && custom > 0 && custom < Number(booking.due_amount);
    setCollecting(true);
    try {
      const res = await recordOfflinePayment({
        booking_no: booking.booking_no,
        payment_method: payMethod,
        request_key: collectionKey,
        ...(useCustom ? { custom_payment_amount: custom } : {}),
      });
      onUpdated(res);
      setCollectionKey(crypto.randomUUID());
      setPayOpen(false);
      setPayAmount("");
      toast.success(`Payment of ${payMethod} recorded.`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not record payment.");
    } finally {
      setCollecting(false);
    }
  };

  const printInvoice = () => {
    const html = invoiceRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=800,height=900");
    w.document.write(`<!doctype html><html><head><title>Invoice ${booking.booking_no}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>@media print{.no-print{display:none}} body{font-family:ui-sans-serif,system-ui,sans-serif}</style>
      </head><body class="p-8">${html}
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  const mixed = new Set((booking.booking_dates || []).map((s) => s.session_type)).size > 1;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl"
          role="dialog" aria-modal="true"
        >
          {/* Header */}
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="min-w-0 break-all font-display text-base font-bold text-slate-900 sm:text-xl">{booking.booking_no}</h2>
                <Badge status={booking.status} />
              </div>
              <p className="text-xs text-slate-500">{mode === "edit" ? "Editing booking details" : "Booking details"}</p>
            </div>
            <div className="flex items-center gap-2 sm:shrink-0">
              {editable && mode === "view" && (
                <button onClick={() => setMode("edit")} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
              )}
              <button onClick={printInvoice} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700">
                <Printer className="h-3.5 w-3.5" /> Invoice
              </button>
              <button onClick={onClose} aria-label="Close" className="ml-auto grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-slate-100 sm:ml-0">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {mode === "view" ? (
              <div className="grid gap-6 lg:grid-cols-2">
               <div>
                {/* Customer */}
                <Section title="Customer">
                  <Detail icon={Users} label="Name" value={booking.customer_name} />
                  <Detail icon={Phone} label="Phone" value={booking.customer_phone} />
                  <Detail icon={Mail} label="Email" value={booking.customer_email || "—"} />
                  <Detail icon={Tag} label="Event type" value={booking.event_type || "—"} />
                  {(booking.event_manager_name || booking.event_manager_phone) && <><Detail icon={Tag} label="Event manager" value={booking.event_manager_name || "—"} /><Detail icon={Phone} label="Manager phone" value={booking.event_manager_phone || "—"} /></>}
                </Section>

                {/* Event */}
                <Section title="Event">
                  <Detail icon={MapPin} label="Centre" value={booking.centre?.name} />
                  <Detail icon={Users} label="Guests" value={booking.guest_count} />
                  <Detail icon={CalendarDays} label="Date" value={`${booking.event_date}${booking.date_count > 1 ? ` +${booking.date_count - 1} more` : ""}`} />
                  <Detail icon={Clock} label="Session" value={mixed ? "Mixed sessions" : sessionLabel(booking.session_type)} />
                  {booking.decorator_name && <><Detail icon={Tag} label="Decorator" value={booking.decorator_name} /><Detail icon={Phone} label="Decorator phone" value={booking.decorator_phone || "—"} /></>}
                </Section>

                {booking.booking_dates?.length > 1 && (
                  <div className="mb-4 rounded-xl bg-slate-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-slate-500">Reserved dates</div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {booking.booking_dates.map((d) => (
                        <div key={`${d.date}-${d.session_type}`} className="flex justify-between rounded-lg bg-white px-3 py-1.5 text-sm">
                          <span className="font-semibold text-slate-700">{d.date}</span>
                          <span className="text-slate-500">{sessionLabel(d.session_type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {booking.food_items?.length > 0 && (
                  <Section title="Food package" icon={Utensils}>
                    <div className="col-span-2 space-y-1">
                      {booking.food_items.map((f, i) => (
                        <div key={i} className="flex justify-between text-sm text-slate-600">
                          <span>{f.menu_name} × {f.quantity}</span>
                          <span className="tabular-nums">{taka(f.total_price)}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

               </div>

               <div className="space-y-4">
                {/* Cost */}
                <div className="rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200/70 sm:p-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cost breakdown</div>
                  <Line label="Venue" value={booking.venue_amount} />
                  {Number(booking.food_amount) > 0 && <Line label="Food" value={booking.food_amount} />}
                  <Line label="Service charge" value={booking.service_charge} />
                  <Line label="VAT" value={booking.vat_amount} />
                  {booking.adjustment_amount !== 0 && (
                    <Line label={`Adjustment${booking.adjustment_reason ? ` · ${booking.adjustment_reason}` : ""}`} value={booking.adjustment_amount} />
                  )}
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-lg font-extrabold text-slate-900">
                    <span>Total</span><span>{taka(booking.total_amount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-700"><span>Paid</span><span>{taka(booking.paid_amount)}</span></div>
                  {booking.due_amount > 0 && <div className="flex justify-between font-semibold text-amber-700"><span>Due</span><span>{taka(booking.due_amount)}</span></div>}
                  {booking.refunded_amount > 0 && <div className="flex justify-between text-rose-600"><span>Refunded</span><span>{taka(booking.refunded_amount)}</span></div>}

                  {/* payment progress */}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.round((Number(booking.paid_amount) / Math.max(Number(booking.total_amount), 1)) * 100))}%` }} />
                  </div>
                </div>

                {/* Manage payment */}
                {editable && booking.due_amount > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-white"><Wallet className="h-5 w-5" /></span>
                        <div>
                          <div className="font-semibold text-slate-900">Collect payment</div>
                          <div className="text-xs text-slate-500"><span>Outstanding</span> <span className="font-semibold text-amber-700">{taka(booking.due_amount)}</span></div>
                        </div>
                      </div>
                      {!payOpen && <button onClick={() => setPayOpen(true)} className="min-h-11 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700">Record payment</button>}
                    </div>
                    {payOpen && (
                      <div className="mt-3 border-t border-amber-200 pt-3">
                        <div className="text-xs font-semibold text-slate-600">Offline payment received</div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {PAY_METHODS.map((m) => (
                            <button key={m.id} onClick={() => setPayMethod(m.id)}
                              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[10px] font-semibold transition ${payMethod === m.id ? "border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-200" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                              <span className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>{m.id[0]}</span>
                              <span className="truncate">{m.id}</span>
                            </button>
                          ))}
                        </div>
                        <label className="mt-3 block">
                          <span className="text-xs font-medium text-slate-500">Amount (blank = full due {taka(booking.due_amount)})</span>
                          <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(booking.due_amount)} className="input mt-1 w-full" />
                        </label>
                        <div className="mt-3 flex gap-2">
                          <button onClick={collectPayment} disabled={collecting} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                            <CheckCircle2 className="h-4 w-4" /> {collecting ? "Recording…" : "Record payment"}
                          </button>
                          <button onClick={() => setPayOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Refund */}
                {refundable > 0 && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose-500 text-white"><Undo2 className="h-5 w-5" /></span>
                        <div>
                          <div className="font-semibold text-slate-900">Issue refund</div>
                          <div className="text-xs text-slate-500"><span>Up to</span> <span className="font-semibold text-rose-700">{taka(refundable)}</span> <span>refundable</span></div>
                        </div>
                      </div>
                      {!refundOpen && <button onClick={() => { setRefundOpen(true); setRefundAmount(String(refundable)); }} className="min-h-11 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700">Refund</button>}
                    </div>
                    {refundOpen && (
                      <div className="mt-3 border-t border-rose-200 pt-3 space-y-2">
                        <label className="block">
                          <span className="text-xs font-medium text-slate-500">Amount (max {taka(refundable)})</span>
                          <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="input mt-1 w-full" />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-slate-500">Reason (optional)</span>
                          <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. goodwill, overpayment" className="input mt-1 w-full" />
                        </label>
                        <div className="flex gap-2">
                          <button onClick={doRefund} disabled={refunding} className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{refunding ? "Processing…" : `Refund ${taka(Number(refundAmount) || 0)}`}</button>
                          <button onClick={() => setRefundOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {booking.payment?.transaction_id && (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    <span>Last payment</span> · {booking.payment.payment_method} · <span className="font-mono">{booking.payment.transaction_id}</span>
                  </div>
                )}

                {/* Attachments */}
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <ImagePlus className="h-3.5 w-3.5" /> Images & documents
                    </div>
                    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 ${uploading ? "opacity-60" : ""}`}>
                      <ImagePlus className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add image"}
                      <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} />
                    </label>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">JPG or PNG · up to 5 MB · landscape 1600 × 900 px works best.</p>
                  {attachments.length === 0 ? (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">No images attached yet.</div>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {attachments.map((url) => (
                        <div key={url} className="group relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                          <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="attachment" className="h-24 w-full object-cover" /></a>
                          <button onClick={() => removeImage(url)} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-rose-600/90 text-white opacity-0 transition group-hover:opacity-100">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      <StickyNote className="h-3.5 w-3.5" /> Internal note
                    </div>
                    {!noteEditing && <button onClick={() => setNoteEditing(true)} className="text-xs font-semibold text-amber-700 hover:underline">{booking.notes ? "Edit" : "Add note"}</button>}
                  </div>
                  {noteEditing ? (
                    <div className="mt-2">
                      <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3} placeholder="Add a private note about this booking…" className="input w-full resize-none" />
                      <div className="mt-2 flex gap-2">
                        <button onClick={saveNote} disabled={savingNote} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{savingNote ? "Saving…" : "Save note"}</button>
                        <button onClick={() => { setNoteDraft(booking.notes || ""); setNoteEditing(false); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 whitespace-pre-wrap text-sm text-amber-900">{booking.notes || <span className="text-amber-600/70">No note yet.</span>}</div>
                  )}
                </div>
               </div>
              </div>
            ) : (
              /* Edit form */
              <div className="grid gap-4 sm:grid-cols-2">
                <EField label="Customer name" value={form.customer_name} onChange={(v) => setForm((f) => ({ ...f, customer_name: v }))} />
                <EField label="Phone" value={form.customer_phone} onChange={(v) => setForm((f) => ({ ...f, customer_phone: v }))} />
                <EField label="Email" value={form.customer_email} onChange={(v) => setForm((f) => ({ ...f, customer_email: v }))} />
                <EField label="Guests" type="number" value={form.guest_count} onChange={(v) => setForm((f) => ({ ...f, guest_count: v }))} />
                <EField label="Event type" value={form.event_type} onChange={(v) => setForm((f) => ({ ...f, event_type: v }))} className="sm:col-span-2" />
                <EField label="Event manager name" value={form.event_manager_name} onChange={(v) => setForm((f) => ({ ...f, event_manager_name: v }))} />
                <EField label="Event manager phone" type="tel" value={form.event_manager_phone} onChange={(v) => setForm((f) => ({ ...f, event_manager_phone: v }))} />
                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="text-xs font-semibold text-slate-600">Price adjustment (discount / surcharge)</div>
                  <p className="mt-0.5 text-xs text-slate-400">Use a negative value for a discount (e.g. -2000), positive for a surcharge.</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <EField label="Adjustment amount (৳)" type="number" value={form.adjustment_amount} onChange={(v) => setForm((f) => ({ ...f, adjustment_amount: v }))} />
                    <EField label="Reason" value={form.adjustment_reason} onChange={(v) => setForm((f) => ({ ...f, adjustment_reason: v }))} />
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    New total ≈ <span className="font-bold text-slate-900">
                      {taka(Number(booking.venue_amount) + Number(booking.food_amount) + Number(booking.service_charge) + Number(booking.vat_amount) + (Number(form.adjustment_amount) || 0))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {mode === "edit" && (
          <div className="flex gap-3 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
              <button onClick={() => setMode("view")} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 sm:px-5">Cancel</button>
              <button onClick={save} disabled={saving} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:px-5">
                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}

          {/* Hidden invoice for printing */}
          <div className="hidden">
            <div ref={invoiceRef}><Invoice booking={booking} centre={centre} /></div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-4">
      <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
function Detail({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <div className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Icon className="h-3.5 w-3.5 shrink-0" /> {label}</div>
      <div className="mt-0.5 break-words font-semibold text-slate-900">{value}</div>
    </div>
  );
}
function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-2 text-slate-700">
      <span className="min-w-0 break-words font-medium">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-900">{taka(value)}</span>
    </div>
  );
}
function EField({ label, value, onChange, type = "text", className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input mt-1 w-full" />
    </label>
  );
}
