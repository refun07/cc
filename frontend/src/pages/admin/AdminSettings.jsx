import { useEffect, useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";
import { adminSettings, adminUpdateSettings } from "../../services/api";
import { PageHead, Card, Loading } from "./ui";
import { toast } from "../../store/toastStore";

export default function AdminSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { adminSettings().then(setForm).catch(() => setForm({ absence_deduction_rate: 1, late_penalty: 0, leave_deduction_rate: 0, late_cutoff: "10:00" })); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminUpdateSettings({
        absence_deduction_rate: Number(form.absence_deduction_rate) || 0,
        late_penalty: Number(form.late_penalty) || 0,
        leave_deduction_rate: Number(form.leave_deduction_rate) || 0,
        late_cutoff: form.late_cutoff || "10:00",
      });
      setForm(updated);
      toast.success("Payroll rules saved.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHead title="Payroll rules" subtitle="Configure how staff salaries are cut for missed or late attendance. Applies to every centre's payroll." />
      {!form ? <Card><Loading rows={4} /></Card> : (
        <Card>
          <div className="max-w-xl space-y-5 p-6">
            <Rule
              label="Absence deduction rate"
              hint="Multiple of one day's salary cut for each absent day. 1.0 = a full day's pay per absence, 0.5 = half."
              suffix="× per-day salary"
              value={form.absence_deduction_rate}
              onChange={(v) => setForm((f) => ({ ...f, absence_deduction_rate: v }))}
            />
            <Rule
              label="Approved-leave deduction rate"
              hint="Multiple of one day's salary cut per approved-leave day. Set 0 for paid leave."
              suffix="× per-day salary"
              value={form.leave_deduction_rate}
              onChange={(v) => setForm((f) => ({ ...f, leave_deduction_rate: v }))}
            />
            <Rule
              label="Late penalty"
              hint="Flat amount deducted for each day the employee is marked late."
              suffix="৳ per late day"
              value={form.late_penalty}
              onChange={(v) => setForm((f) => ({ ...f, late_penalty: v }))}
            />
            <label className="block">
              <span className="text-sm font-semibold text-slate-800">Late check-in cutoff</span>
              <p className="mt-0.5 text-xs text-slate-400">Staff who self check-in after this time are automatically marked late.</p>
              <input type="time" value={form.late_cutoff || "10:00"} onChange={(e) => setForm((f) => ({ ...f, late_cutoff: e.target.value }))} className="input mt-2 w-40" />
            </label>

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
              <SlidersHorizontal className="mb-1 inline h-3.5 w-3.5" /> These are the <b>global defaults</b>. Any value set on an individual employee overrides them. Rules apply the next time payroll is generated; disbursed payslips never change.
            </div>

            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save rules"}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Rule({ label, hint, suffix, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <input type="number" step="0.1" min="0" value={value} onChange={(e) => onChange(e.target.value)} className="input w-40" />
        <span className="text-sm text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}
