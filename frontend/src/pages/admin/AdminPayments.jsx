import { useEffect, useState } from "react";
import { adminPayments } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, Card, Table, Badge, Loading } from "./ui";

export default function AdminPayments() {
  const [rows, setRows] = useState(null);
  useEffect(() => { adminPayments().then(setRows).catch(() => setRows([])); }, []);

  return (
    <div>
      <PageHead title="Payments" subtitle="All transactions and refunds." />
      <Card>
        {!rows ? <Loading /> : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No payments recorded yet.</div>
        ) : (
          <Table head={["Transaction", "Booking", "Centre", "Method", "Amount", "Refunded", "Status", "Paid at"]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.transaction_id || "—"}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.booking_no}</td>
                <td className="px-5 py-3 text-slate-600">{p.centre}</td>
                <td className="px-5 py-3 text-slate-600">{p.method}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{taka(p.amount)}</td>
                <td className="px-5 py-3 tabular-nums text-violet-700">{p.refunded_amount > 0 ? taka(p.refunded_amount) : "—"}</td>
                <td className="px-5 py-3"><Badge status={p.status} /></td>
                <td className="px-5 py-3 text-xs tabular-nums text-slate-500">{p.paid_at || "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
