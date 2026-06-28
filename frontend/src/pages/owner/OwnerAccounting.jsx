import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, Percent, ArrowDownLeft, ArrowUpRight, Clock3, HandCoins } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ownerAccounting } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, StatCard, Card, Table, Loading, Badge } from "../admin/ui";

const COLORS = ["#059669", "#2563eb", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6", "#64748b"];

export default function OwnerAccounting() {
  const [d, setD] = useState(null);
  useEffect(() => { ownerAccounting().then(setD).catch(() => setD(null)); }, []);
  if (!d) return <Loading rows={4} />;
  const s = d.summary;

  return (
    <div>
      <PageHead title="Accounting" subtitle="Income, expenses, payroll, profit and DSCC payout settlements for your centre." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="Total income" value={s.income} money accent="emerald" />
        <StatCard icon={TrendingDown} label="Total expense" value={s.expense} money accent="rose" />
        <StatCard icon={Wallet} label="Net profit" value={s.net_profit} money accent={s.net_profit >= 0 ? "brand" : "rose"} />
        <StatCard icon={Percent} label="Profit margin" value={`${s.margin}%`} accent="violet" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="text-sm text-amber-700">Pending expenses</div>
          <div className="mt-1 text-xl font-extrabold text-amber-800">{taka(s.expense_pending)}</div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="text-sm text-blue-700">Pending payroll</div>
          <div className="mt-1 text-xl font-extrabold text-blue-800">{taka(s.payroll_pending)}</div>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <div className="flex items-center justify-between text-sm text-violet-700"><span>Settlement payable</span><Clock3 className="h-5 w-5" /></div>
          <div className="mt-1 text-xl font-extrabold text-violet-800">{taka(s.settlement_payable)}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center justify-between text-sm text-emerald-700"><span>Settlements received</span><HandCoins className="h-5 w-5" /></div>
          <div className="mt-1 text-xl font-extrabold text-emerald-800">{taka(s.settlement_paid)}</div>
        </div>
      </div>

      <Card title="DSCC settlements" action={<span className="text-xs text-slate-400">Based on payment date</span>}>
        {!d.settlements?.length ? (
          <div className="p-10 text-center text-sm text-slate-400">No settlement has been generated yet.</div>
        ) : (
          <Table head={["Settlement", "Period", "Bookings", "Gross", "Fee", "Tax", "Adjustment", "Net payout", "Status"]}>
            {d.settlements.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{row.settlement_no}</td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{row.period_start} <span className="text-slate-300">→</span> {row.period_end}</td>
                <td className="px-5 py-3 text-center tabular-nums">{row.items_count}</td>
                <td className="px-5 py-3 tabular-nums">{taka(row.gross_amount)}</td>
                <td className="px-5 py-3 tabular-nums text-slate-500">{taka(row.commission_amount)}</td>
                <td className="px-5 py-3 tabular-nums text-slate-500">{taka(row.tax_amount)}</td>
                <td className={`px-5 py-3 tabular-nums ${Number(row.adjustment_amount) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{taka(row.adjustment_amount)}</td>
                <td className="px-5 py-3 font-extrabold tabular-nums text-emerald-700">{taka(row.net_amount)}</td>
                <td className="px-5 py-3"><Badge status={row.status} />{row.payment_reference && <div className="mt-1 font-mono text-[10px] text-slate-400">{row.payment_reference}</div>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Expense breakdown">
          <div className="h-72 p-4">
            {d.by_category?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.by_category} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {d.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => taka(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-sm text-slate-400">No expenses recorded yet.</div>}
          </div>
        </Card>

        <Card title="Ledger" action={<span className="text-xs text-slate-400">Last 60 entries</span>}>
          {d.ledger.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">No transactions yet.</div>
          ) : (
            <Table head={["Date", "Description", "Category", "Type", "Amount"]}>
              {d.ledger.map((l, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-5 py-3 tabular-nums text-slate-500">{l.date}</td>
                  <td className="px-5 py-3 text-slate-700">{l.desc}{l.ref && <span className="ml-1 font-mono text-xs text-slate-400">{l.ref}</span>}</td>
                  <td className="px-5 py-3 text-slate-500">{l.category || "—"}</td>
                  <td className="px-5 py-3">
                    {l.type === "income"
                      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><ArrowDownLeft className="h-3.5 w-3.5" /> Income</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><ArrowUpRight className="h-3.5 w-3.5" /> Expense</span>}
                  </td>
                  <td className={`px-5 py-3 text-right font-semibold tabular-nums ${l.type === "income" ? "text-emerald-700" : "text-rose-700"}`}>
                    {l.type === "income" ? "+" : "−"}{taka(l.amount)}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
