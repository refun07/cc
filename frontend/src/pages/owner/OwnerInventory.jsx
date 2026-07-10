import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Boxes, Building2,
  ClipboardCheck, PackageCheck, PackageOpen, Plus, RotateCcw, Search,
  ShieldAlert, Truck, Warehouse, X, ScanLine, Loader2, Upload, ImagePlus,
  Tags, Pencil, Check, Trash2, ChevronDown, Download, FileSpreadsheet,
} from "lucide-react";
import {
  ownerAdjustStock, ownerCreate, ownerCreatePurchaseOrder, ownerCreateSupplier,
  ownerCancelStockCount, ownerCreateStockCount, ownerDeleteSupplier, ownerInventorySystem,
  ownerPostStockCount, ownerReceivePurchaseOrder, ownerRecordDamage,
  ownerRemove, ownerReturnPurchaseOrder, ownerStockMovements, ownerUpdate,
  ownerUpdateDamageStatus, ownerUpdatePurchaseOrderStatus, ownerUpdatePurchaseOrder, ownerDeletePurchaseOrder, ownerUpdateSupplier, ownerScanPurchaseOrder,
  ownerUpload, ownerScanProducts, ownerInventoryTaxonomy, ownerAddTaxonomy, ownerRenameTaxonomy, ownerDeleteTaxonomy,
  ownerAddLot, ownerUpdateLot, ownerDeleteLot, ownerDeletePurchaseReturn, ownerDeleteDamage, ownerDeleteStockCount,
} from "../../services/api";
import { taka } from "../../lib/format";
import { Badge, Card, Loading, PageHead, StatCard, Table } from "../admin/ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const TABS = [
  ["products", "Products", Boxes], ["suppliers", "Suppliers", Building2],
  ["orders", "Purchase orders", Truck], ["lots", "Lots & expiry", Warehouse],
  ["counts", "Stock counts", ClipboardCheck], ["returns", "PO returns", RotateCcw],
  ["damages", "Damage", ShieldAlert],
];
// Scalable product-type registry. Add a new type here and every lot/receive form
// picks up its date requirements automatically — no other code changes needed.
const PRODUCT_TYPES = {
  physical: { label: "Physical (no expiry)", lotDates: false, requireExpiry: false },
  perishable: { label: "Perishable (mfg & expiry)", lotDates: true, requireExpiry: true },
};
const typeConfig = (t) => PRODUCT_TYPES[t] || PRODUCT_TYPES.physical;

const PRODUCT_BLANK = { name: "", image: "", category: "", product_type: "physical", sku: "", barcode: "", brand: "", storage_location: "", unit: "", current_stock: 0, minimum_stock: 0, purchase_price: 0, average_cost: 0, track_lots: true, condition: "good", status: "active" };
const SUPPLIER_BLANK = { name: "", contact_person: "", phone: "", email: "", address: "", tax_id: "", payment_terms: "30 days", status: "active", notes: "" };

export default function OwnerInventory() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("products");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [taxonomy, setTaxonomy] = useState({ categories: [], brands: [] });
  const load = () => { setData(null); ownerInventorySystem().then(setData).catch(() => setData(emptyData())); };
  const loadTaxonomy = () => ownerInventoryTaxonomy().then(setTaxonomy).catch(() => {});
  useEffect(() => { load(); loadTaxonomy(); }, []);
  const filtered = useMemo(() => filterRows(tab, data, query), [tab, data, query]);
  const s = data?.summary || {};

  const action = tab === "products" ? ["Add product", () => setModal({ type: "product" })]
    : tab === "suppliers" ? ["Add supplier", () => setModal({ type: "supplier" })]
      : tab === "orders" ? ["New purchase order", () => setModal({ type: "po" })]
        : tab === "lots" ? ["Add lot", () => setModal({ type: "lot" })]
        : tab === "counts" ? ["New stock count", () => setModal({ type: "count" })]
        : tab === "damages" ? ["Report damage", () => setModal({ type: "damage" })] : null;

  const orderStatus = async (po, status) => {
    if (!(await askConfirm({ title: status === "cancelled" ? "Cancel purchase order?" : "Place purchase order?", message: `${po.po_no} will be marked ${status}.`, confirmText: status === "cancelled" ? "Cancel PO" : "Place order", danger: status === "cancelled" }))) return;
    try { await ownerUpdatePurchaseOrderStatus(po.id, status); toast.success("Purchase order updated."); load(); } catch (error) { toast.error(apiError(error)); }
  };

  return <div>
    <PageHead title="Inventory & Procurement" subtitle="Products, suppliers, purchase orders, receiving, multi-lot stock, returns, damage and audit movements.">
      <div className="flex gap-2">
        <button onClick={() => setModal({ type: "export" })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />Export</button>
        {tab === "products" && <button onClick={() => setModal({ type: "taxonomy" })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Tags className="h-4 w-4" />Manage lists</button>}
        {tab === "products" && <button onClick={() => setModal({ type: "bulk" })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload className="h-4 w-4" />Bulk upload</button>}
        {action && <button onClick={action[1]} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Plus className="h-4 w-4" />{action[0]}</button>}
      </div>
    </PageHead>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <StatCard icon={Boxes} label="Products" value={s.items || 0} accent="blue" />
      <StatCard icon={Warehouse} label="Stock value" value={s.stock_value || 0} money accent="emerald" />
      <StatCard icon={AlertTriangle} label="Low stock" value={s.low_stock || 0} accent="rose" />
      <StatCard icon={Truck} label="Open POs" value={s.open_pos || 0} accent="violet" />
      <StatCard icon={ClipboardCheck} label="Expiring lots" value={s.expiring_lots || 0} accent="amber" />
      <StatCard icon={ShieldAlert} label="Damaged units" value={s.damaged_units || 0} accent="rose" />
    </div>

    <div className="mt-5 flex gap-2 overflow-x-auto pb-2">{TABS.map(([value, label, Icon]) => <button key={value} onClick={() => { setTab(value); setQuery(""); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-semibold ${tab === value ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
    <div className="my-4 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={`Search ${TABS.find(([value]) => value === tab)?.[1].toLowerCase()}…`} /></div>

    {!data ? <Card><Loading rows={8} /></Card> : <InventoryTable tab={tab} rows={filtered} setModal={setModal} load={load} orderStatus={orderStatus} />}

    <ProductModal open={modal?.type === "product"} item={modal?.item} taxonomy={taxonomy} onTaxonomyChange={loadTaxonomy} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); loadTaxonomy(); }} />
    <BulkProductModal open={modal?.type === "bulk"} taxonomy={taxonomy} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); loadTaxonomy(); }} />
    <TaxonomyModal open={modal?.type === "taxonomy"} taxonomy={taxonomy} onChange={setTaxonomy} onClose={() => { setModal(null); load(); }} />
    <ExportModal open={modal?.type === "export"} data={data} onClose={() => setModal(null)} />
    <SupplierModal open={modal?.type === "supplier"} supplier={modal?.supplier} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
    <PurchaseOrderModal open={modal?.type === "po"} data={data} po={modal?.po} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
    <ReceiveModal po={modal?.type === "receive" ? modal.po : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
    <ReturnModal po={modal?.type === "return" ? modal.po : null} lots={data?.lots || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
    <DamageModal open={modal?.type === "damage"} data={data} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
    <StockCountModal open={modal?.type === "count"} count={modal?.count} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
    <StockModal item={modal?.type === "stock" ? modal.item : null} lots={data?.lots || []} onClose={() => { setModal(null); load(); }} />
    <LotModal open={modal?.type === "lot"} lot={modal?.lot} data={data} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
  </div>;
}

function InventoryTable({ tab, rows, setModal, load, orderStatus }) {
  const resolveDamage = async (report, status) => {
    const recovering = status === "recovered";
    if (!(await askConfirm({
      title: recovering ? "Recover damaged stock?" : "Dispose damaged stock?",
      message: recovering
        ? `${report.quantity} ${report.item?.unit || "units"} will be restored to available stock.`
        : "This damage report will be closed as disposed. Stock will remain deducted.",
      confirmText: recovering ? "Recover stock" : "Mark disposed",
      danger: !recovering,
    }))) return;
    try {
      await ownerUpdateDamageStatus(report.id, status);
      toast.success(recovering ? "Stock recovered and restored." : "Damage marked as disposed.");
      load();
    } catch (error) {
      toast.error(apiError(error));
    }
  };

  const cancelCount = async (count) => {
    if (!(await askConfirm({ title: "Cancel stock count?", message: `${count.count_no} will be closed without changing stock.`, confirmText: "Cancel count", danger: true }))) return;
    try { await ownerCancelStockCount(count.id); toast.success("Stock count cancelled."); load(); } catch (error) { toast.error(apiError(error)); }
  };

  const deletePO = async (po) => {
    if (!(await askConfirm({ title: "Delete purchase order?", message: `${po.po_no} will be permanently removed. Only draft or cancelled orders with no received stock can be deleted.`, confirmText: "Delete", danger: true }))) return;
    try { await ownerDeletePurchaseOrder(po.id); toast.success("Purchase order deleted."); load(); } catch (error) { toast.error(apiError(error)); }
  };

  const deleteLot = async (lot) => {
    if (!(await askConfirm({ title: "Delete lot?", message: `Lot ${lot.lot_no} will be removed and its ${lot.available_quantity} available units drawn out of product stock.`, confirmText: "Delete", danger: true }))) return;
    try { await ownerDeleteLot(lot.id); toast.success("Lot removed."); load(); } catch (error) { toast.error(apiError(error)); }
  };

  const deleteReturn = async (row) => {
    if (!(await askConfirm({ title: "Reverse & delete return?", message: `${row.return_no} will be reversed — returned stock is restored — and the record removed.`, confirmText: "Reverse & delete", danger: true }))) return;
    try { await ownerDeletePurchaseReturn(row.id); toast.success("Return reversed and removed."); load(); } catch (error) { toast.error(apiError(error)); }
  };

  const deleteDamage = async (row) => {
    if (!(await askConfirm({ title: "Delete damage report?", message: `${row.report_no} will be removed.${row.status === "recorded" ? " The damaged stock will be restored." : ""}`, confirmText: "Delete", danger: true }))) return;
    try { await ownerDeleteDamage(row.id); toast.success("Damage report removed."); load(); } catch (error) { toast.error(apiError(error)); }
  };

  const deleteCount = async (count) => {
    if (!(await askConfirm({ title: "Delete stock count?", message: `${count.count_no} will be permanently removed.`, confirmText: "Delete", danger: true }))) return;
    try { await ownerDeleteStockCount(count.id); toast.success("Stock count removed."); load(); } catch (error) { toast.error(apiError(error)); }
  };

  if (!rows.length) return <Card><div className="p-12 text-center text-sm text-slate-400">No records found in this section.</div></Card>;
  if (tab === "products") return <Card><Table head={["Product", "Category", "Stock", "Average cost", "Value", "Location", "Status", "Actions"]}>{rows.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Boxes className="h-4 w-4 text-slate-300" />}</span><div><div className="flex items-center gap-1.5 font-semibold text-slate-800">{item.name}{item.product_type === "perishable" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">PERISHABLE</span>}</div><div className="font-mono text-xs text-slate-400">{item.sku || "No SKU"}{item.brand ? ` · ${item.brand}` : ""}</div></div></div></td><td className="px-5 py-3 text-slate-600">{item.category || "—"}</td><td className={`px-5 py-3 font-semibold tabular-nums ${Number(item.current_stock) <= Number(item.minimum_stock) ? "text-rose-600" : "text-slate-800"}`}>{item.current_stock} {item.unit}{Number(item.current_stock) <= Number(item.minimum_stock) && <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px]">LOW</span>}</td><td className="px-5 py-3 tabular-nums">{taka(item.average_cost)}</td><td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{taka(Number(item.current_stock) * Number(item.average_cost))}</td><td className="px-5 py-3 text-slate-500">{item.storage_location || "—"}</td><td className="px-5 py-3"><Badge status={item.status} /></td><td className="px-5 py-3"><div className="flex min-w-max gap-2"><SmallButton onClick={() => setModal({ type: "stock", item })} icon={ArrowLeftRight}>Movement</SmallButton><SmallButton onClick={() => setModal({ type: "product", item })}>Edit</SmallButton><SmallButton danger onClick={async () => { if (await askConfirm({ title: "Delete product?", message: "Products used in procurement documents cannot be deleted.", confirmText: "Delete", danger: true })) try { await ownerRemove("inventory", item.id); load(); } catch (error) { toast.error(apiError(error)); } }}>Delete</SmallButton></div></td></tr>)}</Table></Card>;
  if (tab === "suppliers") return <Card><Table head={["Supplier", "Contact", "Payment terms", "POs", "Status", "Actions"]}>{rows.map((supplier) => <tr key={supplier.id} className="hover:bg-slate-50"><td className="px-5 py-3"><div className="font-semibold text-slate-800">{supplier.name}</div><div className="text-xs text-slate-400">{supplier.tax_id || "No tax ID"}</div></td><td className="px-5 py-3"><div>{supplier.contact_person || "—"}</div><div className="text-xs text-slate-400">{supplier.phone || supplier.email}</div></td><td className="px-5 py-3 text-slate-600">{supplier.payment_terms || "—"}</td><td className="px-5 py-3 text-center">{supplier.purchase_orders_count}</td><td className="px-5 py-3"><Badge status={supplier.status} /></td><td className="px-5 py-3"><div className="flex gap-2"><SmallButton onClick={() => setModal({ type: "supplier", supplier })}>Edit</SmallButton><SmallButton danger onClick={async () => { if (await askConfirm({ title: "Delete supplier?", message: "This is allowed only when no purchase orders exist.", confirmText: "Delete", danger: true })) try { await ownerDeleteSupplier(supplier.id); load(); } catch (error) { toast.error(apiError(error)); } }}>Delete</SmallButton></div></td></tr>)}</Table></Card>;
  if (tab === "orders") return <Card><Table head={["PO", "Supplier", "Dates", "Lines", "Received", "Total", "Status", "Actions"]}>{rows.map((po) => { const ordered = po.items.reduce((sum, line) => sum + Number(line.ordered_quantity), 0); const received = po.items.reduce((sum, line) => sum + Number(line.received_quantity), 0); return <tr key={po.id} className="hover:bg-slate-50"><td className="px-5 py-3 font-mono text-xs text-slate-500">{po.po_no}</td><td className="px-5 py-3 font-medium text-slate-800">{po.supplier?.name}</td><td className="px-5 py-3 text-slate-600"><div>{po.order_date}</div><div className="text-xs text-slate-400">Expected {po.expected_date || "—"}</div></td><td className="px-5 py-3 text-center">{po.items.length}</td><td className="px-5 py-3 tabular-nums">{received}/{ordered}</td><td className="px-5 py-3 font-semibold">{taka(po.total_amount)}</td><td className="px-5 py-3"><Badge status={po.status} /></td><td className="px-5 py-3"><div className="flex min-w-max gap-2">{po.status === "draft" && <><SmallButton onClick={() => orderStatus(po, "ordered")} icon={PackageCheck}>Order</SmallButton><SmallButton onClick={() => setModal({ type: "po", po })} icon={Pencil}>Edit</SmallButton><SmallButton danger onClick={() => orderStatus(po, "cancelled")}>Cancel</SmallButton></>}{["ordered", "partially_received"].includes(po.status) && <SmallButton onClick={() => setModal({ type: "receive", po })} icon={PackageOpen}>Receive</SmallButton>}{received > po.items.reduce((sum, line) => sum + Number(line.returned_quantity), 0) && <SmallButton onClick={() => setModal({ type: "return", po })} icon={RotateCcw}>Return</SmallButton>}{["draft", "cancelled"].includes(po.status) && received === 0 && <SmallButton danger icon={Trash2} onClick={() => deletePO(po)}>Delete</SmallButton>}</div></td></tr>; })}</Table></Card>;
  if (tab === "lots") return <Card><Table head={["Lot", "Product", "Supplier", "Received", "Available", "Damaged", "Cost", "Expiry", "Status", "Actions"]}>{rows.map((lot) => <tr key={lot.id} className="hover:bg-slate-50"><td className="px-5 py-3 font-mono text-xs text-slate-600">{lot.lot_no}</td><td className="px-5 py-3"><div className="font-medium text-slate-800">{lot.item?.name}</div><div className="text-xs text-slate-400">{lot.item?.sku}</div></td><td className="px-5 py-3 text-slate-600">{lot.supplier?.name || "—"}</td><td className="px-5 py-3 tabular-nums">{lot.received_quantity}</td><td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{lot.available_quantity}</td><td className="px-5 py-3 tabular-nums text-rose-600">{lot.damaged_quantity}</td><td className="px-5 py-3">{taka(lot.unit_cost)}</td><td className={`px-5 py-3 ${lot.expires_at && new Date(lot.expires_at) <= new Date(Date.now() + 30 * 864e5) ? "font-semibold text-amber-700" : "text-slate-600"}`}>{lot.expires_at || "No expiry"}</td><td className="px-5 py-3"><Badge status={lot.status} /></td><td className="px-5 py-3"><div className="flex min-w-max gap-2"><SmallButton onClick={() => setModal({ type: "lot", lot })} icon={Pencil}>Edit</SmallButton><SmallButton danger icon={Trash2} onClick={() => deleteLot(lot)}>Delete</SmallButton></div></td></tr>)}</Table></Card>;
  if (tab === "counts") return <Card><Table head={["Count", "Date", "Lines", "System qty", "Variance", "Status", "Actions"]}>{rows.map((count) => { const system = count.lines.reduce((sum, line) => sum + Number(line.system_quantity), 0); const variance = count.lines.reduce((sum, line) => sum + Number(line.variance || 0), 0); return <tr key={count.id} className="hover:bg-slate-50"><td className="px-5 py-3"><div className="font-mono text-xs font-semibold text-slate-600">{count.count_no}</div><div className="text-xs text-slate-400">{count.notes || "Physical inventory count"}</div></td><td className="px-5 py-3">{count.count_date}</td><td className="px-5 py-3 text-center">{count.lines.length}</td><td className="px-5 py-3 tabular-nums">{system}</td><td className={`px-5 py-3 font-semibold tabular-nums ${variance < 0 ? "text-rose-600" : variance > 0 ? "text-emerald-700" : "text-slate-500"}`}>{variance > 0 ? "+" : ""}{variance}</td><td className="px-5 py-3"><Badge status={count.status} /></td><td className="px-5 py-3"><div className="flex min-w-max gap-2">{count.status === "draft" ? <><SmallButton onClick={() => setModal({ type: "count", count })} icon={ClipboardCheck}>Continue</SmallButton><SmallButton danger onClick={() => cancelCount(count)}>Cancel</SmallButton></> : <span className="text-xs text-slate-400">Closed</span>}{count.status !== "posted" && <SmallButton danger icon={Trash2} onClick={() => deleteCount(count)}>Delete</SmallButton>}</div></td></tr>; })}</Table></Card>;
  if (tab === "returns") return <Card><Table head={["Return", "PO", "Supplier", "Date", "Items", "Reason", "Amount", "Status", "Actions"]}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-3 font-mono text-xs text-slate-500">{row.return_no}</td><td className="px-5 py-3 font-mono text-xs">{row.purchase_order?.po_no}</td><td className="px-5 py-3">{row.supplier?.name}</td><td className="px-5 py-3">{row.return_date}</td><td className="px-5 py-3 text-center">{row.items?.length || 0}</td><td className="px-5 py-3 text-slate-500">{row.reason || "—"}</td><td className="px-5 py-3 font-semibold text-rose-700">{taka(row.total_amount)}</td><td className="px-5 py-3"><Badge status={row.status} /></td><td className="px-5 py-3"><SmallButton danger icon={RotateCcw} onClick={() => deleteReturn(row)}>Reverse</SmallButton></td></tr>)}</Table></Card>;
  return <Card><Table head={["Report", "Product", "Lot", "Quantity", "Reason", "Date", "Status", "Actions"]}>{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="px-5 py-3 font-mono text-xs text-slate-500">{row.report_no}</td><td className="px-5 py-3 font-medium text-slate-800">{row.item?.name}</td><td className="px-5 py-3 font-mono text-xs">{row.lot?.lot_no || "—"}</td><td className="px-5 py-3 font-semibold text-rose-700">−{row.quantity} {row.item?.unit}</td><td className="px-5 py-3 text-slate-600">{row.reason}</td><td className="px-5 py-3">{row.created_at?.slice(0, 10)}</td><td className="px-5 py-3"><Badge status={row.status} /></td><td className="px-5 py-3"><div className="flex min-w-max gap-2">{row.status === "recorded" ? <><SmallButton onClick={() => resolveDamage(row, "recovered")} icon={RotateCcw}>Recover</SmallButton><SmallButton danger onClick={() => resolveDamage(row, "disposed")}>Dispose</SmallButton></> : <span className="self-center text-xs text-slate-400">Resolved</span>}<SmallButton danger icon={Trash2} onClick={() => deleteDamage(row)}>Delete</SmallButton></div></td></tr>)}</Table></Card>;
}

const TAX_GROUPS = [
  ["category", "categories", "Categories"],
  ["brand", "brands", "Brands"],
  ["unit", "units", "Units"],
  ["storage_location", "storage_locations", "Storage locations"],
];

function TaxonomyModal({ open, taxonomy, onChange, onClose }) {
  const [adding, setAdding] = useState({});
  const [editing, setEditing] = useState(null); // { type, name, value }
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const add = async (type) => {
    const name = (adding[type] || "").trim();
    if (!name) return; setBusy(true);
    try { const list = await ownerAddTaxonomy(type, name); onChange((t) => ({ ...t, [TAX_GROUPS.find((g) => g[0] === type)[1]]: list })); setAdding((a) => ({ ...a, [type]: "" })); toast.success("Added."); }
    catch (error) { toast.error(apiError(error)); } finally { setBusy(false); }
  };
  const rename = async () => {
    const value = (editing.value || "").trim();
    if (!value) return; setBusy(true);
    try { const list = await ownerRenameTaxonomy(editing.type, editing.name, value); onChange((t) => ({ ...t, [TAX_GROUPS.find((g) => g[0] === editing.type)[1]]: list })); setEditing(null); toast.success("Renamed."); }
    catch (error) { toast.error(apiError(error)); } finally { setBusy(false); }
  };
  const remove = async (type, name) => {
    if (!(await askConfirm({ title: "Delete from list?", message: `“${name}” will be removed. Products currently using it must be reassigned first.`, confirmText: "Delete", danger: true }))) return;
    try { const list = await ownerDeleteTaxonomy(type, name); onChange((t) => ({ ...t, [TAX_GROUPS.find((g) => g[0] === type)[1]]: list })); toast.success("Removed."); }
    catch (error) { toast.error(apiError(error)); }
  };

  return <Modal title="Manage product lists" onClose={onClose} wide>
    <p className="mb-4 text-sm text-slate-500">Add, rename or delete categories, brands, units and storage locations. Changes are saved instantly and shared across all product forms.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      {TAX_GROUPS.map(([type, key, label]) => {
        const list = taxonomy[key] || [];
        return <div key={type} className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-800">{label}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{list.length}</span></div>
          <div className="space-y-1.5">
            {!list.length && <p className="py-2 text-center text-xs text-slate-400">No entries yet.</p>}
            {list.map((name) => editing && editing.type === type && editing.name === name
              ? <div key={name} className="flex items-center gap-1.5">
                  <input autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && rename()} className="input min-h-10 flex-1 py-1.5 text-sm" />
                  <button type="button" disabled={busy} onClick={rename} className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setEditing(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
                </div>
              : <div key={name} className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-slate-50">
                  <span className="flex-1 truncate text-sm text-slate-700">{name}</span>
                  <button type="button" onClick={() => setEditing({ type, name, value: name })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => remove(type, name)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>)}
          </div>
          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3">
            <input value={adding[type] || ""} onChange={(e) => setAdding((a) => ({ ...a, [type]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && add(type)} placeholder={`Add ${label.toLowerCase().replace(/s$/, "")}…`} className="input min-h-10 flex-1 py-1.5 text-sm" />
            <button type="button" disabled={busy} onClick={() => add(type)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"><Plus className="h-4 w-4" />Add</button>
          </div>
        </div>;
      })}
    </div>
    <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-900">Done</button></div>
  </Modal>;
}

// ---- Bulk export: report definitions, CSV helpers, modal ----
const sum = (arr, fn) => arr.reduce((t, x) => t + Number(fn(x) || 0), 0);
const d10 = (v) => (v ? String(v).slice(0, 10) : "");

/** Each report: rows(data) + a column list (key/label/get). Columns are individually toggleable. */
const EXPORT_REPORTS = [
  { key: "products", label: "Products", rows: (d) => d.items || [], columns: [
    { key: "name", label: "Name", get: (r) => r.name },
    { key: "sku", label: "SKU", get: (r) => r.sku },
    { key: "barcode", label: "Barcode", get: (r) => r.barcode },
    { key: "category", label: "Category", get: (r) => r.category },
    { key: "product_type", label: "Product type", get: (r) => r.product_type || "physical" },
    { key: "brand", label: "Brand", get: (r) => r.brand },
    { key: "unit", label: "Unit", get: (r) => r.unit },
    { key: "storage_location", label: "Storage location", get: (r) => r.storage_location },
    { key: "current_stock", label: "Current stock", get: (r) => r.current_stock },
    { key: "minimum_stock", label: "Reorder level", get: (r) => r.minimum_stock },
    { key: "purchase_price", label: "Purchase price", get: (r) => r.purchase_price },
    { key: "average_cost", label: "Average cost", get: (r) => r.average_cost },
    { key: "stock_value", label: "Stock value", get: (r) => (Number(r.current_stock) * Number(r.average_cost)).toFixed(2) },
    { key: "condition", label: "Condition", get: (r) => r.condition },
    { key: "status", label: "Status", get: (r) => r.status },
  ] },
  { key: "suppliers", label: "Suppliers", rows: (d) => d.suppliers || [], columns: [
    { key: "name", label: "Name", get: (r) => r.name },
    { key: "contact_person", label: "Contact person", get: (r) => r.contact_person },
    { key: "phone", label: "Phone", get: (r) => r.phone },
    { key: "email", label: "Email", get: (r) => r.email },
    { key: "address", label: "Address", get: (r) => r.address },
    { key: "tax_id", label: "Tax ID", get: (r) => r.tax_id },
    { key: "payment_terms", label: "Payment terms", get: (r) => r.payment_terms },
    { key: "status", label: "Status", get: (r) => r.status },
  ] },
  { key: "orders", label: "Purchase orders", rows: (d) => d.purchase_orders || [], columns: [
    { key: "po_no", label: "PO no", get: (r) => r.po_no },
    { key: "supplier", label: "Supplier", get: (r) => r.supplier?.name },
    { key: "order_date", label: "Order date", get: (r) => d10(r.order_date) },
    { key: "expected_date", label: "Expected date", get: (r) => d10(r.expected_date) },
    { key: "status", label: "Status", get: (r) => r.status },
    { key: "lines", label: "Lines", get: (r) => (r.items || []).length },
    { key: "ordered", label: "Ordered qty", get: (r) => sum(r.items || [], (l) => l.ordered_quantity) },
    { key: "received", label: "Received qty", get: (r) => sum(r.items || [], (l) => l.received_quantity) },
    { key: "subtotal", label: "Subtotal", get: (r) => r.subtotal },
    { key: "discount_amount", label: "Discount", get: (r) => r.discount_amount },
    { key: "tax_amount", label: "Tax", get: (r) => r.tax_amount },
    { key: "total_amount", label: "Total", get: (r) => r.total_amount },
  ] },
  { key: "lots", label: "Lots & expiry", rows: (d) => d.lots || [], columns: [
    { key: "lot_no", label: "Lot no", get: (r) => r.lot_no },
    { key: "product", label: "Product", get: (r) => r.item?.name },
    { key: "supplier", label: "Supplier", get: (r) => r.supplier?.name },
    { key: "received_quantity", label: "Received", get: (r) => r.received_quantity },
    { key: "available_quantity", label: "Available", get: (r) => r.available_quantity },
    { key: "damaged_quantity", label: "Damaged", get: (r) => r.damaged_quantity },
    { key: "unit_cost", label: "Unit cost", get: (r) => r.unit_cost },
    { key: "manufactured_at", label: "Manufactured", get: (r) => d10(r.manufactured_at) },
    { key: "expires_at", label: "Expiry", get: (r) => d10(r.expires_at) },
    { key: "status", label: "Status", get: (r) => r.status },
  ] },
  { key: "counts", label: "Stock counts", rows: (d) => d.stock_counts || [], columns: [
    { key: "count_no", label: "Count no", get: (r) => r.count_no },
    { key: "count_date", label: "Date", get: (r) => d10(r.count_date) },
    { key: "status", label: "Status", get: (r) => r.status },
    { key: "lines", label: "Lines", get: (r) => (r.lines || []).length },
    { key: "system", label: "System qty", get: (r) => sum(r.lines || [], (l) => l.system_quantity) },
    { key: "counted", label: "Counted qty", get: (r) => sum(r.lines || [], (l) => l.counted_quantity) },
    { key: "variance", label: "Variance", get: (r) => sum(r.lines || [], (l) => l.variance) },
  ] },
  { key: "returns", label: "PO returns", rows: (d) => d.returns || [], columns: [
    { key: "return_no", label: "Return no", get: (r) => r.return_no },
    { key: "po_no", label: "PO", get: (r) => r.purchase_order?.po_no },
    { key: "supplier", label: "Supplier", get: (r) => r.supplier?.name },
    { key: "return_date", label: "Date", get: (r) => d10(r.return_date) },
    { key: "items", label: "Items", get: (r) => (r.items || []).length },
    { key: "reason", label: "Reason", get: (r) => r.reason },
    { key: "total_amount", label: "Amount", get: (r) => r.total_amount },
    { key: "status", label: "Status", get: (r) => r.status },
  ] },
  { key: "damages", label: "Damage reports", rows: (d) => d.damages || [], columns: [
    { key: "report_no", label: "Report no", get: (r) => r.report_no },
    { key: "product", label: "Product", get: (r) => r.item?.name },
    { key: "lot", label: "Lot", get: (r) => r.lot?.lot_no },
    { key: "quantity", label: "Quantity", get: (r) => r.quantity },
    { key: "reason", label: "Reason", get: (r) => r.reason },
    { key: "date", label: "Date", get: (r) => d10(r.created_at) },
    { key: "status", label: "Status", get: (r) => r.status },
  ] },
];

const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csvBlock = (columns, rows) => [columns.map((c) => csvCell(c.label)).join(","), ...rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(","))].join("\n");
const downloadFile = (name, text) => { const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

function ExportModal({ open, data, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [sel, setSel] = useState({});           // report key -> Set of enabled column keys
  const [expanded, setExpanded] = useState(null);
  const [format, setFormat] = useState("combined"); // combined | separate
  const [productStatus, setProductStatus] = useState("all"); // all | active | inactive
  const [lowOnly, setLowOnly] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Default: all reports selected, all columns enabled.
    const init = {}; EXPORT_REPORTS.forEach((r) => { init[r.key] = new Set(r.columns.map((c) => c.key)); });
    setSel(init); setExpanded(null); setFormat("combined"); setProductStatus("all"); setLowOnly(false);
  }, [open]);
  if (!open) return null;

  const toggleReport = (key) => setSel((s) => { const n = { ...s }; if (n[key]) delete n[key]; else n[key] = new Set(EXPORT_REPORTS.find((r) => r.key === key).columns.map((c) => c.key)); return n; });
  const toggleColumn = (key, col) => setSel((s) => {
    const set = new Set(s[key]);
    if (set.has(col)) set.delete(col); else set.add(col);
    return { ...s, [key]: set };
  });

  const rowsFor = (report) => {
    let rows = report.rows(data || {});
    if (report.key === "products") {
      if (productStatus !== "all") rows = rows.filter((r) => (r.status || "active") === productStatus);
      if (lowOnly) rows = rows.filter((r) => Number(r.current_stock) <= Number(r.minimum_stock));
    }
    return rows;
  };

  const chosen = EXPORT_REPORTS.filter((r) => sel[r.key] && sel[r.key].size > 0);
  const totalRows = chosen.reduce((t, r) => t + rowsFor(r).length, 0);

  const run = () => {
    if (!chosen.length) return toast.error("Select at least one report to export.");
    const blocks = chosen.map((report) => {
      const columns = report.columns.filter((c) => sel[report.key].has(c.key));
      return { report, columns, rows: rowsFor(report) };
    });
    if (format === "separate") {
      blocks.forEach((b, i) => setTimeout(() => downloadFile(`inventory-${b.report.key}-${today}.csv`, csvBlock(b.columns, b.rows)), i * 350));
      toast.success(`Exporting ${blocks.length} file${blocks.length === 1 ? "" : "s"}…`);
    } else {
      const text = blocks.map((b) => `${b.report.label} (${b.rows.length})\n${csvBlock(b.columns, b.rows)}`).join("\n\n");
      downloadFile(`inventory-report-${today}.csv`, text);
      toast.success(`Exported ${totalRows} row${totalRows === 1 ? "" : "s"} across ${blocks.length} report${blocks.length === 1 ? "" : "s"}.`);
    }
    onClose();
  };

  return <Modal title="Export inventory reports" onClose={onClose} wide>
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Choose which reports to include, pick the exact columns, apply filters, and export to CSV (opens in Excel / Google Sheets).</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {EXPORT_REPORTS.map((report) => {
          const on = !!sel[report.key];
          const count = rowsFor(report).length;
          const isOpen = expanded === report.key;
          return <div key={report.key} className={`rounded-2xl border ${on ? "border-brand-200 bg-brand-50/40" : "border-slate-200"}`}>
            <div className="flex items-center gap-2 p-3">
              <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={on} onChange={() => toggleReport(report.key)} className="h-5 w-5 accent-brand-600" />
                <span className="font-semibold text-slate-800">{report.label}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
              </label>
              {on && <button type="button" onClick={() => setExpanded(isOpen ? null : report.key)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">{sel[report.key].size}/{report.columns.length} cols <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} /></button>}
            </div>
            {on && isOpen && <div className="flex flex-wrap gap-1.5 border-t border-brand-100 p-3">
              {report.columns.map((c) => { const active = sel[report.key].has(c.key); return <button key={c.key} type="button" onClick={() => toggleColumn(report.key, c.key)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${active ? "bg-brand-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{c.label}</button>; })}
            </div>}
          </div>;
        })}
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Product filters</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select label="Status" value={productStatus} set={setProductStatus} options={[["all", "All statuses"], ["active", "Active only"], ["inactive", "Inactive only"]]} />
            <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="h-5 w-5 accent-brand-600" />Low stock only</label>
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Output format</div>
          <div className="mt-2 space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="radio" name="fmt" checked={format === "combined"} onChange={() => setFormat("combined")} className="h-4 w-4 accent-brand-600" />Single combined CSV (sectioned)</label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="radio" name="fmt" checked={format === "separate"} onChange={() => setFormat("separate")} className="h-4 w-4 accent-brand-600" />Separate CSV file per report</label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-sm text-slate-500"><span className="font-semibold text-slate-800">{chosen.length}</span> report{chosen.length === 1 ? "" : "s"} · <span className="font-semibold text-slate-800">{totalRows}</span> row{totalRows === 1 ? "" : "s"}</div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" onClick={run} disabled={!chosen.length} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><FileSpreadsheet className="h-4 w-4" />Export CSV</button>
        </div>
      </div>
    </div>
  </Modal>;
}

function ProductModal({ open, item, taxonomy = { categories: [], brands: [] }, onTaxonomyChange, onClose, onSaved }) {
  const [form, setForm] = useState(PRODUCT_BLANK); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  useEffect(() => { if (open) setForm(item ? { ...PRODUCT_BLANK, ...item } : { ...PRODUCT_BLANK }); }, [open, item]);
  const TAX_LABELS = { category: "Category", brand: "Brand", unit: "Unit", storage_location: "Storage location" };
  const addTaxonomy = async (type, name) => { try { await ownerAddTaxonomy(type, name); setForm((f) => ({ ...f, [type]: name })); toast.success(`${TAX_LABELS[type]} “${name}” added.`); onTaxonomyChange?.(); } catch (error) { toast.error(apiError(error)); } };
  const renameTaxonomy = async (type, name, newName) => { try { await ownerRenameTaxonomy(type, name, newName); toast.success("Renamed."); onTaxonomyChange?.(); } catch (error) { toast.error(apiError(error)); } };
  const deleteTaxonomy = async (type, name) => { try { await ownerDeleteTaxonomy(type, name); toast.success("Removed."); onTaxonomyChange?.(); return true; } catch (error) { toast.error(apiError(error)); return false; } };
  if (!open) return null;
  const uploadImage = async (file) => { if (!file) return; setUploading(true); try { const { url } = await ownerUpload(file); setForm((f) => ({ ...f, image: url })); } catch (error) { toast.error(apiError(error)); } finally { setUploading(false); } };
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { if (item) await ownerUpdate("inventory", item.id, form); else await ownerCreate("inventory", form); toast.success(item ? "Product updated." : "Product created."); onSaved(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  return <Modal title={item ? "Edit product" : "Add inventory product"} onClose={onClose} wide>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">{form.image ? <img src={form.image} alt="" className="h-full w-full object-cover" /> : <Boxes className="h-6 w-6 text-slate-300" />}</span>
        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${uploading ? "opacity-60" : ""}`}>
          <ImagePlus className="h-4 w-4" /> {uploading ? "Uploading…" : form.image ? "Change image" : "Add product image"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files[0])} disabled={uploading} />
        </label>
      </div>
      <Input label="Product name" value={form.name} set={(value) => setForm({ ...form, name: value })} required full />
      <Input label="SKU" value={form.sku || ""} set={(value) => setForm({ ...form, sku: value })} />
      <Input label="Barcode" value={form.barcode || ""} set={(value) => setForm({ ...form, barcode: value })} />
      <ComboInput label="Category" value={form.category || ""} set={(value) => setForm({ ...form, category: value })} options={taxonomy.categories || []} placeholder="Type to search or create…" onCreate={(name) => addTaxonomy("category", name)} onRename={(name, nv) => renameTaxonomy("category", name, nv)} onDelete={(name) => deleteTaxonomy("category", name)} />
      <ComboInput label="Brand" value={form.brand || ""} set={(value) => setForm({ ...form, brand: value })} options={taxonomy.brands || []} placeholder="Type to search or create…" onCreate={(name) => addTaxonomy("brand", name)} onRename={(name, nv) => renameTaxonomy("brand", name, nv)} onDelete={(name) => deleteTaxonomy("brand", name)} />
      <div className="sm:col-span-2">
        <span className="text-xs font-semibold text-slate-600">Product type</span>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {Object.entries(PRODUCT_TYPES).map(([key, cfg]) => <button key={key} type="button" onClick={() => setForm({ ...form, product_type: key })} className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${(form.product_type || "physical") === key ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{cfg.label}</button>)}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">{typeConfig(form.product_type).lotDates ? "Lots for this product will require manufacture & expiry dates." : "Lots for this product don't track expiry."}</p>
      </div>
      <ComboInput label="Storage location" value={form.storage_location || ""} set={(value) => setForm({ ...form, storage_location: value })} options={taxonomy.storage_locations || []} placeholder="Type to search or create…" onCreate={(name) => addTaxonomy("storage_location", name)} onRename={(name, nv) => renameTaxonomy("storage_location", name, nv)} onDelete={(name) => deleteTaxonomy("storage_location", name)} />
      <ComboInput label="Unit" value={form.unit || ""} set={(value) => setForm({ ...form, unit: value })} options={taxonomy.units || []} placeholder="Type to search or create…" onCreate={(name) => addTaxonomy("unit", name)} onRename={(name, nv) => renameTaxonomy("unit", name, nv)} onDelete={(name) => deleteTaxonomy("unit", name)} />
      {item ? <div><span className="text-xs font-semibold text-slate-600">Current stock</span><div className="mt-1 min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700">{form.current_stock} {form.unit}<span className="ml-2 text-xs font-normal text-slate-400">Use Movement to change</span></div></div> : <Input label="Opening stock" type="number" value={form.current_stock} set={(value) => setForm({ ...form, current_stock: Number(value) })} />}
      <Input label="Reorder level" type="number" value={form.minimum_stock} set={(value) => setForm({ ...form, minimum_stock: Number(value) })} />
      <Input label="Purchase price" type="number" value={form.purchase_price} set={(value) => setForm({ ...form, purchase_price: Number(value) })} />
      <Input label="Average cost" type="number" value={form.average_cost} set={(value) => setForm({ ...form, average_cost: Number(value) })} />
      <Select label="Condition" value={form.condition} set={(value) => setForm({ ...form, condition: value })} options={["good", "fair", "damaged"]} />
      <Select label="Status" value={form.status} set={(value) => setForm({ ...form, status: value })} options={["active", "inactive"]} />
      <label className="flex items-center gap-2 pt-6 text-sm text-slate-600"><input type="checkbox" checked={!!form.track_lots} onChange={(event) => setForm({ ...form, track_lots: event.target.checked })} className="h-5 w-5 accent-brand-600" />Track lots and expiry</label>
      <ModalActions busy={busy} onClose={onClose} />
    </form>
  </Modal>;
}

const BULK_ROW = () => ({ key: crypto.randomUUID(), name: "", category: "General", brand: "", sku: "", unit: "pcs", current_stock: 0, minimum_stock: 0, purchase_price: 0 });

function BulkProductModal({ open, taxonomy = { categories: [], brands: [] }, onClose, onSaved }) {
  const [rows, setRows] = useState([BULK_ROW()]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setRows([BULK_ROW()]); } }, [open]);
  const categories = taxonomy.categories || [];
  const brands = taxonomy.brands || [];
  if (!open) return null;

  const upd = (key, field, value) => setRows((r) => r.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  const addRow = () => setRows((r) => [...r, BULK_ROW()]);
  const delRow = (key) => setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));

  const scan = async (file) => {
    if (!file) return; setScanning(true);
    try {
      const parsed = await ownerScanProducts(file);
      if (!parsed.length) return toast.error("No products could be read from the file.");
      setRows(parsed.map((p) => ({ ...BULK_ROW(), ...p })));
      toast.success(`Read ${parsed.length} product${parsed.length === 1 ? "" : "s"} — review and save.`);
    } catch (error) { toast.error(apiError(error)); }
    finally { setScanning(false); }
  };

  const saveAll = async () => {
    const valid = rows.filter((r) => r.name.trim());
    if (!valid.length) return toast.error("Add at least one product with a name.");
    setBusy(true);
    let ok = 0;
    for (const r of valid) {
      try {
        await ownerCreate("inventory", {
          name: r.name.trim(), category: r.category || "General", brand: r.brand || "", sku: r.sku || "", unit: r.unit || "pcs",
          current_stock: Number(r.current_stock) || 0, minimum_stock: Number(r.minimum_stock) || 0, purchase_price: Number(r.purchase_price) || 0,
          average_cost: Number(r.purchase_price) || 0, track_lots: false, condition: "good", status: "active",
        });
        ok++;
      } catch { /* keep going, report at end */ }
    }
    setBusy(false);
    if (ok) toast.success(`${ok} product${ok === 1 ? "" : "s"} added.`);
    if (ok < valid.length) toast.error(`${valid.length - ok} row${valid.length - ok === 1 ? "" : "s"} failed.`);
    if (ok) onSaved();
  };

  return <Modal title="Bulk add products" onClose={onClose} wide>
    <div className="space-y-4">
      <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-brand-200 bg-brand-50/60 p-3">
        {scanning && <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute inset-y-0 -left-1/3 w-1/3 animate-[scanx_1.2s_linear_infinite] bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" /></div>}
        <div className="text-sm text-slate-600">Have a product list or invoice? <span className="font-semibold text-slate-800">Scan it</span> (image or PDF) to fill the rows below.</div>
        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 ${scanning ? "opacity-70" : ""}`}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} {scanning ? "Reading…" : "Scan list"}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => scan(e.target.files[0])} disabled={scanning} />
        </label>
      </div>

      <datalist id="bulk-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="bulk-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      <datalist id="bulk-units">{(taxonomy.units || []).map((u) => <option key={u} value={u} />)}</datalist>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase text-slate-400">
            <th className="p-2">Name *</th><th className="p-2">Category</th><th className="p-2">Brand</th><th className="p-2">SKU</th><th className="p-2">Unit</th><th className="p-2 text-right">Stock</th><th className="p-2 text-right">Reorder</th><th className="p-2 text-right">Price</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-slate-50">
                <td className="p-1.5"><input value={r.name} onChange={(e) => upd(r.key, "name", e.target.value)} className="input py-1 text-xs" placeholder="Product name" /></td>
                <td className="p-1.5"><input value={r.category} list="bulk-categories" onChange={(e) => upd(r.key, "category", e.target.value)} className="input py-1 text-xs" /></td>
                <td className="p-1.5"><input value={r.brand} list="bulk-brands" onChange={(e) => upd(r.key, "brand", e.target.value)} className="input py-1 text-xs" /></td>
                <td className="p-1.5"><input value={r.sku} onChange={(e) => upd(r.key, "sku", e.target.value)} className="input py-1 text-xs" /></td>
                <td className="p-1.5"><input value={r.unit} list="bulk-units" onChange={(e) => upd(r.key, "unit", e.target.value)} className="input py-1 w-16 text-xs" /></td>
                <td className="p-1.5"><input type="number" value={r.current_stock} onChange={(e) => upd(r.key, "current_stock", e.target.value)} className="input py-1 w-20 text-right text-xs tabular-nums" /></td>
                <td className="p-1.5"><input type="number" value={r.minimum_stock} onChange={(e) => upd(r.key, "minimum_stock", e.target.value)} className="input py-1 w-20 text-right text-xs tabular-nums" /></td>
                <td className="p-1.5"><input type="number" value={r.purchase_price} onChange={(e) => upd(r.key, "purchase_price", e.target.value)} className="input py-1 w-24 text-right text-xs tabular-nums" /></td>
                <td className="p-1.5"><button type="button" onClick={() => delRow(r.key)} className="grid h-7 w-7 place-items-center rounded text-slate-300 hover:bg-rose-50 hover:text-rose-500"><X className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"><Plus className="h-4 w-4" /> Add row</button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" onClick={saveAll} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : `Save ${rows.filter((r) => r.name.trim()).length} products`}</button>
        </div>
      </div>
    </div>
  </Modal>;
}

function SupplierModal({ open, supplier, onClose, onSaved }) {
  const [form, setForm] = useState(SUPPLIER_BLANK); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm(supplier ? { ...SUPPLIER_BLANK, ...supplier } : { ...SUPPLIER_BLANK }); }, [open, supplier]); if (!open) return null;
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { if (supplier) await ownerUpdateSupplier(supplier.id, form); else await ownerCreateSupplier(form); toast.success("Supplier saved."); onSaved(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  return <Modal title={supplier ? "Edit supplier" : "Add supplier"} onClose={onClose}><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><Input label="Supplier name" value={form.name} set={(v) => setForm({ ...form, name: v })} required full /><Input label="Contact person" value={form.contact_person || ""} set={(v) => setForm({ ...form, contact_person: v })} /><Input label="Phone" value={form.phone || ""} set={(v) => setForm({ ...form, phone: v })} /><Input label="Email" type="email" value={form.email || ""} set={(v) => setForm({ ...form, email: v })} /><Input label="Tax ID" value={form.tax_id || ""} set={(v) => setForm({ ...form, tax_id: v })} /><Input label="Payment terms" value={form.payment_terms || ""} set={(v) => setForm({ ...form, payment_terms: v })} /><Select label="Status" value={form.status} set={(v) => setForm({ ...form, status: v })} options={["active", "inactive"]} /><TextArea label="Address" value={form.address || ""} set={(v) => setForm({ ...form, address: v })} full /><TextArea label="Notes" value={form.notes || ""} set={(v) => setForm({ ...form, notes: v })} full /><ModalActions busy={busy} onClose={onClose} /></form></Modal>;
}

function PurchaseOrderModal({ open, data, po, onClose, onSaved }) {
  const editing = !!po;
  const [form, setForm] = useState({ supplier_id: "", order_date: new Date().toISOString().slice(0, 10), expected_date: "", discount_amount: 0, tax_amount: 0, notes: "", lines: [] }); const [busy, setBusy] = useState(false); const [scanning, setScanning] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (po) {
      setForm({
        supplier_id: po.supplier_id || po.supplier?.id || "", order_date: po.order_date || new Date().toISOString().slice(0, 10),
        expected_date: po.expected_date || "", discount_amount: Number(po.discount_amount) || 0, tax_amount: Number(po.tax_amount) || 0,
        notes: po.notes || "", lines: (po.items || []).map((it) => ({ key: crypto.randomUUID(), inventory_item_id: it.inventory_item_id, quantity: Number(it.ordered_quantity), unit_cost: Number(it.unit_cost) })),
      });
    } else {
      setForm({ supplier_id: data?.suppliers?.find((s) => s.status === "active")?.id || "", order_date: new Date().toISOString().slice(0, 10), expected_date: "", discount_amount: 0, tax_amount: 0, notes: "", lines: [] });
    }
  }, [open, data, po]); if (!open) return null;
  const scanInvoice = async (file) => {
    if (!file) return; setScanning(true);
    try {
      const r = await ownerScanPurchaseOrder(file);
      const norm = (s) => (s || "").toLowerCase().trim();
      const supplier = (data.suppliers || []).find((s) => r.supplier_name && (norm(s.name).includes(norm(r.supplier_name)) || norm(r.supplier_name).includes(norm(s.name))));
      const lines = []; let unmatched = 0;
      for (const l of r.lines || []) {
        const prod = data.items.find((it) => norm(it.name) === norm(l.name)) || data.items.find((it) => norm(it.name).includes(norm(l.name)) || norm(l.name).includes(norm(it.name)));
        if (prod) lines.push({ key: crypto.randomUUID(), inventory_item_id: prod.id, quantity: l.quantity || 1, unit_cost: l.unit_cost || Number(prod.purchase_price || 0) });
        else unmatched++;
      }
      setForm((f) => ({
        ...f,
        supplier_id: supplier?.id ?? f.supplier_id,
        order_date: r.order_date || f.order_date,
        expected_date: r.expected_date || f.expected_date,
        discount_amount: r.discount || 0,
        tax_amount: r.tax || 0,
        notes: r.notes || f.notes,
        lines: lines.length ? lines : f.lines,
      }));
      toast.success(`Filled ${lines.length} line${lines.length === 1 ? "" : "s"}${supplier ? `, supplier ${supplier.name}` : ""}${unmatched ? ` · ${unmatched} unmatched product${unmatched === 1 ? "" : "s"}` : ""}.`);
    } catch (error) { toast.error(apiError(error)); }
    finally { setScanning(false); }
  };
  const addLine = () => { const used = new Set(form.lines.map((line) => String(line.inventory_item_id))); const item = data.items.find((row) => !used.has(String(row.id))); if (!item) return toast.info("All products are already included."); setForm({ ...form, lines: [...form.lines, { key: crypto.randomUUID(), inventory_item_id: item.id, quantity: 1, unit_cost: Number(item.purchase_price || item.average_cost || 0) }] }); };
  const updateLine = (key, field, value) => setForm({ ...form, lines: form.lines.map((line) => line.key === key ? { ...line, [field]: value } : line) });
  const subtotal = form.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_cost || 0), 0);
  const submit = async (event) => { event.preventDefault(); if (!form.lines.length) return toast.error("Add at least one product."); setBusy(true); try { const payload = { ...form, supplier_id: Number(form.supplier_id), lines: form.lines.map(({ inventory_item_id, quantity, unit_cost }) => ({ inventory_item_id: Number(inventory_item_id), quantity: Number(quantity), unit_cost: Number(unit_cost) })) }; if (editing) { await ownerUpdatePurchaseOrder(po.id, payload); toast.success("Purchase order updated."); } else { await ownerCreatePurchaseOrder(payload); toast.success("Purchase order created as draft."); } onSaved(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  return <Modal title={editing ? `Edit ${po.po_no}` : "New purchase order"} onClose={onClose} wide><form onSubmit={submit} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/60 p-3"><div className="text-sm text-slate-600">Have a supplier invoice or quotation? <span className="font-semibold text-slate-800">Scan it to auto-fill</span> this order.</div><label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 ${scanning ? "opacity-70" : ""}`}>{scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}{scanning ? "Reading…" : "Scan invoice"}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => scanInvoice(e.target.files[0])} disabled={scanning} /></label></div><div className="grid gap-3 sm:grid-cols-3"><Select label="Supplier" value={form.supplier_id} set={(v) => setForm({ ...form, supplier_id: v })} options={(data?.suppliers || []).filter((s) => s.status === "active").map((s) => [s.id, s.name])} required /><Input label="Order date" type="date" value={form.order_date} set={(v) => setForm({ ...form, order_date: v })} required /><Input label="Expected date" type="date" value={form.expected_date} set={(v) => setForm({ ...form, expected_date: v })} /></div><div className="rounded-2xl border border-slate-200"><div className="flex items-center justify-between border-b p-3"><span className="font-semibold text-slate-800">Products</span><button type="button" onClick={addLine} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700"><Plus className="h-4 w-4" />Add line</button></div><div className="space-y-2 p-3">{!form.lines.length ? <p className="py-6 text-center text-sm text-slate-400">Add products to this order.</p> : form.lines.map((line) => <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_110px_140px_44px]"><Select label="Product" value={line.inventory_item_id} set={(v) => updateLine(line.key, "inventory_item_id", v)} options={data.items.map((item) => [item.id, item.name])} /><Input label="Quantity" type="number" value={line.quantity} set={(v) => updateLine(line.key, "quantity", v)} /><Input label="Unit cost" type="number" value={line.unit_cost} set={(v) => updateLine(line.key, "unit_cost", v)} /><button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((row) => row.key !== line.key) })} className="mt-auto grid h-11 w-11 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><X className="h-4 w-4" /></button></div>)}</div></div><div className="grid gap-3 sm:grid-cols-3"><Input label="Discount" type="number" value={form.discount_amount} set={(v) => setForm({ ...form, discount_amount: Number(v) })} /><Input label="Tax" type="number" value={form.tax_amount} set={(v) => setForm({ ...form, tax_amount: Number(v) })} /><div className="rounded-xl bg-slate-50 p-3 text-right"><div className="text-xs text-slate-400">PO total</div><div className="text-xl font-extrabold">{taka(Math.max(subtotal - Number(form.discount_amount) + Number(form.tax_amount), 0))}</div></div></div><TextArea label="Notes" value={form.notes} set={(v) => setForm({ ...form, notes: v })} /><ModalActions busy={busy} onClose={onClose} /></form></Modal>;
}

function LotModal({ open, lot, data, onClose, onSaved }) {
  const editing = !!lot;
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const selectedItem = (data?.items || []).find((i) => String(i.id) === String(editing ? lot.inventory_item_id : form.inventory_item_id));
  const cfg = typeConfig(selectedItem?.product_type);
  useEffect(() => {
    if (!open) return;
    if (lot) setForm({ available_quantity: Number(lot.available_quantity), lot_no: lot.lot_no || "", unit_cost: Number(lot.unit_cost) || 0, manufactured_at: lot.manufactured_at || "", expires_at: lot.expires_at || "", status: lot.status || "active", reason: "" });
    else setForm({ inventory_item_id: "", supplier_id: "", received_quantity: 1, unit_cost: 0, lot_no: "", manufactured_at: "", expires_at: "" });
  }, [open, lot]);
  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (cfg.requireExpiry && cfg.lotDates && !form.expires_at) return toast.error(`${selectedItem?.name || "This product"} is perishable — set an expiry date.`);
    setBusy(true);
    try {
      if (editing) {
        await ownerUpdateLot(lot.id, { available_quantity: Number(form.available_quantity), lot_no: form.lot_no, unit_cost: Number(form.unit_cost), manufactured_at: form.manufactured_at || null, expires_at: form.expires_at || null, status: form.status, reason: form.reason || null });
        toast.success("Lot updated.");
      } else {
        if (!form.inventory_item_id) { setBusy(false); return toast.error("Choose a product."); }
        await ownerAddLot({ inventory_item_id: Number(form.inventory_item_id), supplier_id: form.supplier_id ? Number(form.supplier_id) : null, received_quantity: Number(form.received_quantity), unit_cost: Number(form.unit_cost), lot_no: form.lot_no || null, manufactured_at: form.manufactured_at || null, expires_at: form.expires_at || null });
        toast.success("Lot added and stock updated.");
      }
      onSaved();
    } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); }
  };

  return <Modal title={editing ? `Edit lot ${lot.lot_no}` : "Add stock lot"} onClose={onClose}>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {editing ? <>
        <Input label="Available quantity" type="number" value={form.available_quantity} set={(v) => setForm({ ...form, available_quantity: v })} />
        <Input label="Unit cost" type="number" value={form.unit_cost} set={(v) => setForm({ ...form, unit_cost: v })} />
        <Input label="Lot / batch no" value={form.lot_no} set={(v) => setForm({ ...form, lot_no: v })} />
        <Select label="Status" value={form.status} set={(v) => setForm({ ...form, status: v })} options={["active", "quarantine", "depleted", "expired"]} />
        {cfg.lotDates ? <>
          <Input label="Manufactured" type="date" value={form.manufactured_at} set={(v) => setForm({ ...form, manufactured_at: v })} />
          <Input label={`Expiry${cfg.requireExpiry ? " *" : ""}`} type="date" value={form.expires_at} set={(v) => setForm({ ...form, expires_at: v })} />
        </> : <div className="sm:col-span-2 self-end text-xs text-slate-400">Physical product — no expiry tracking.</div>}
        <Input label="Reason for change" value={form.reason} set={(v) => setForm({ ...form, reason: v })} full />
        <p className="sm:col-span-2 text-xs text-slate-400">Changing available quantity adjusts the product's total stock and logs a movement.</p>
      </> : <>
        <Select label="Product" value={form.inventory_item_id} set={(v) => { const it = (data?.items || []).find((i) => String(i.id) === String(v)); setForm({ ...form, inventory_item_id: v, unit_cost: it ? Number(it.purchase_price || it.average_cost || 0) : form.unit_cost }); }} options={(data?.items || []).map((i) => [i.id, i.name])} required />
        <Select label="Supplier (optional)" value={form.supplier_id} set={(v) => setForm({ ...form, supplier_id: v })} options={[["", "— none —"], ...(data?.suppliers || []).filter((s) => s.status === "active").map((s) => [s.id, s.name])]} />
        <Input label="Quantity received" type="number" value={form.received_quantity} set={(v) => setForm({ ...form, received_quantity: v })} required />
        <Input label="Unit cost" type="number" value={form.unit_cost} set={(v) => setForm({ ...form, unit_cost: v })} />
        <Input label="Lot / batch no (optional)" value={form.lot_no} set={(v) => setForm({ ...form, lot_no: v })} />
        <div />
        {!selectedItem ? <div className="sm:col-span-2 text-xs text-slate-400">Select a product to see its date requirements.</div>
          : cfg.lotDates ? <>
            <Input label="Manufactured" type="date" value={form.manufactured_at} set={(v) => setForm({ ...form, manufactured_at: v })} />
            <Input label={`Expiry${cfg.requireExpiry ? " *" : ""}`} type="date" value={form.expires_at} set={(v) => setForm({ ...form, expires_at: v })} />
          </> : <div className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{selectedItem.name} is a physical product — no manufacture/expiry dates needed.</div>}
      </>}
      <ModalActions busy={busy} onClose={onClose} saveLabel={editing ? "Save lot" : "Add lot"} />
    </form>
  </Modal>;
}

function ReceiveModal({ po, onClose, onSaved }) {
  const [lines, setLines] = useState([]); const [busy, setBusy] = useState(false);
  useEffect(() => { if (po) setLines(po.items.filter((item) => Number(item.received_quantity) < Number(item.ordered_quantity)).map((item) => ({ purchase_order_item_id: item.id, name: item.item?.name, product_type: item.item?.product_type, quantity: Number(item.ordered_quantity) - Number(item.received_quantity), lot_no: `LOT-${Date.now().toString().slice(-6)}-${item.id}`, manufactured_at: "", expires_at: "" }))); }, [po]); if (!po) return null;
  const update = (id, field, value) => setLines(lines.map((line) => line.purchase_order_item_id === id ? { ...line, [field]: value } : line));
  const submit = async (event) => {
    event.preventDefault();
    const missing = lines.find((l) => typeConfig(l.product_type).requireExpiry && !l.expires_at);
    if (missing) return toast.error(`${missing.name} is perishable — set an expiry date.`);
    setBusy(true);
    try { await ownerReceivePurchaseOrder(po.id, { lines: lines.map(({ name: _name, product_type: _pt, ...line }) => ({ ...line, quantity: Number(line.quantity), manufactured_at: line.manufactured_at || null, expires_at: line.expires_at || null })) }); toast.success("Stock received and lots created."); onSaved(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); }
  };
  return <Modal title={`Receive ${po.po_no}`} onClose={onClose} wide><form onSubmit={submit} className="space-y-3">{lines.map((line) => { const cfg = typeConfig(line.product_type); return <div key={line.purchase_order_item_id} className={`grid gap-2 rounded-xl border border-slate-200 p-3 ${cfg.lotDates ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}><div className="sm:col-span-full font-semibold text-slate-800">{line.name}{cfg.lotDates && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">PERISHABLE</span>}</div><Input label="Receive qty" type="number" value={line.quantity} set={(v) => update(line.purchase_order_item_id, "quantity", v)} required /><Input label="Lot / batch no" value={line.lot_no} set={(v) => update(line.purchase_order_item_id, "lot_no", v)} required />{cfg.lotDates && <><Input label="Manufactured" type="date" value={line.manufactured_at} set={(v) => update(line.purchase_order_item_id, "manufactured_at", v)} /><Input label={`Expiry${cfg.requireExpiry ? " *" : ""}`} type="date" value={line.expires_at} set={(v) => update(line.purchase_order_item_id, "expires_at", v)} /></>}</div>; })}<ModalActions busy={busy} onClose={onClose} saveLabel="Receive stock" /></form></Modal>;
}

function ReturnModal({ po, lots, onClose, onSaved }) {
  const options = useMemo(() => po ? po.items.flatMap((line) => lots.filter((lot) => lot.purchase_order_item_id === line.id && Number(lot.available_quantity) > 0).map((lot) => ({ poItem: line, lot }))) : [], [po, lots]);
  const [form, setForm] = useState({ return_date: new Date().toISOString().slice(0, 10), reason: "Damaged or incorrect supply", notes: "", lines: [] }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (po) setForm({ return_date: new Date().toISOString().slice(0, 10), reason: "Damaged or incorrect supply", notes: "", lines: [] }); }, [po]); if (!po) return null;
  const add = () => { const option = options.find((entry) => !form.lines.some((line) => line.inventory_lot_id === entry.lot.id)); if (!option) return toast.info("All returnable lots are included."); setForm({ ...form, lines: [...form.lines, { key: crypto.randomUUID(), purchase_order_item_id: option.poItem.id, inventory_lot_id: option.lot.id, quantity: 1 }] }); };
  const submit = async (event) => { event.preventDefault(); if (!form.lines.length) return toast.error("Add a lot to return."); setBusy(true); try { await ownerReturnPurchaseOrder(po.id, { ...form, lines: form.lines.map(({ key: _key, ...line }) => ({ ...line, quantity: Number(line.quantity) })) }); toast.success("Purchase return recorded."); onSaved(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  return <Modal title={`Return against ${po.po_no}`} onClose={onClose}><form onSubmit={submit} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input label="Return date" type="date" value={form.return_date} set={(v) => setForm({ ...form, return_date: v })} required /><Input label="Reason" value={form.reason} set={(v) => setForm({ ...form, reason: v })} /></div><button type="button" onClick={add} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700"><Plus className="h-4 w-4" />Add return lot</button>{form.lines.map((line) => { const option = options.find((entry) => entry.lot.id === line.inventory_lot_id); return <div key={line.key} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_120px_44px]"><div><div className="font-semibold">{option?.poItem.item?.name}</div><div className="text-xs text-slate-400">Lot {option?.lot.lot_no} · available {option?.lot.available_quantity}</div></div><Input label="Quantity" type="number" value={line.quantity} set={(v) => setForm({ ...form, lines: form.lines.map((row) => row.key === line.key ? { ...row, quantity: v } : row) })} /><button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((row) => row.key !== line.key) })} className="mt-auto grid h-11 w-11 place-items-center text-rose-500"><X className="h-4 w-4" /></button></div>; })}<TextArea label="Notes" value={form.notes} set={(v) => setForm({ ...form, notes: v })} /><ModalActions busy={busy} onClose={onClose} saveLabel="Confirm return" /></form></Modal>;
}

function DamageModal({ open, data, onClose, onSaved }) {
  const [form, setForm] = useState({ inventory_item_id: "", inventory_lot_id: "", quantity: 1, reason: "Broken during handling", notes: "" }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm({ inventory_item_id: data?.items?.[0]?.id || "", inventory_lot_id: "", quantity: 1, reason: "Broken during handling", notes: "" }); }, [open, data]); if (!open) return null;
  const itemLots = (data?.lots || []).filter((lot) => String(lot.inventory_item_id) === String(form.inventory_item_id) && Number(lot.available_quantity) > 0);
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await ownerRecordDamage({ ...form, inventory_item_id: Number(form.inventory_item_id), inventory_lot_id: form.inventory_lot_id ? Number(form.inventory_lot_id) : null, quantity: Number(form.quantity) }); toast.success("Damage recorded and stock reduced."); onSaved(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  return <Modal title="Report damaged stock" onClose={onClose}><form onSubmit={submit} className="space-y-3"><Select label="Product" value={form.inventory_item_id} set={(v) => setForm({ ...form, inventory_item_id: v, inventory_lot_id: "" })} options={(data?.items || []).map((item) => [item.id, `${item.name} · ${item.current_stock} ${item.unit}`])} required /><Select label="Lot (optional)" value={form.inventory_lot_id} set={(v) => setForm({ ...form, inventory_lot_id: v })} options={[["", "Unallocated / no lot"], ...itemLots.map((lot) => [lot.id, `${lot.lot_no} · ${lot.available_quantity} available`])]} /><Input label="Quantity" type="number" value={form.quantity} set={(v) => setForm({ ...form, quantity: v })} required /><Input label="Reason" value={form.reason} set={(v) => setForm({ ...form, reason: v })} required /><TextArea label="Notes" value={form.notes} set={(v) => setForm({ ...form, notes: v })} /><ModalActions busy={busy} onClose={onClose} saveLabel="Record damage" /></form></Modal>;
}

function StockCountModal({ open, count: initialCount, onClose, onSaved }) {
  const [count, setCount] = useState(null); const [form, setForm] = useState({ count_date: new Date().toISOString().slice(0, 10), notes: "" }); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) return; setCount(initialCount ? { ...initialCount, lines: initialCount.lines.map((line) => ({ ...line, counted_quantity: line.counted_quantity ?? line.system_quantity })) } : null); setForm({ count_date: new Date().toISOString().slice(0, 10), notes: "" }); }, [open, initialCount]);
  if (!open) return null;
  const start = async (event) => { event.preventDefault(); setBusy(true); try { const created = await ownerCreateStockCount(form); setCount({ ...created, lines: created.lines.map((line) => ({ ...line, counted_quantity: line.system_quantity })) }); toast.success("Count sheet created. Enter the physical quantities."); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  const post = async (event) => { event.preventDefault(); setBusy(true); try { await ownerPostStockCount(count.id, count.lines.map((line) => ({ id: line.id, counted_quantity: Number(line.counted_quantity) }))); toast.success("Stock count posted and variances reconciled."); onSaved(); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  if (!count) return <Modal title="Start physical stock count" onClose={onClose}><form onSubmit={start} className="space-y-3"><Input label="Count date" type="date" value={form.count_date} set={(v) => setForm({ ...form, count_date: v })} required /><TextArea label="Notes / count area" value={form.notes} set={(v) => setForm({ ...form, notes: v })} /><div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Starting a count snapshots every active product and lot. Post it before recording other stock movements.</div><ModalActions busy={busy} onClose={onClose} saveLabel="Create count sheet" /></form></Modal>;
  const totalVariance = count.lines.reduce((sum, line) => sum + Number(line.counted_quantity || 0) - Number(line.system_quantity), 0);
  return <Modal title={`${count.count_no} · physical count`} onClose={onClose} wide><form onSubmit={post} className="space-y-3"><div className="grid grid-cols-3 rounded-xl bg-slate-50 p-3 text-center text-sm"><div><div className="text-xs text-slate-400">Count lines</div><b>{count.lines.length}</b></div><div><div className="text-xs text-slate-400">Date</div><b>{count.count_date}</b></div><div><div className="text-xs text-slate-400">Current variance</div><b className={totalVariance < 0 ? "text-rose-600" : totalVariance > 0 ? "text-emerald-700" : "text-slate-700"}>{totalVariance > 0 ? "+" : ""}{totalVariance}</b></div></div><div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">{count.lines.map((line) => { const variance = Number(line.counted_quantity || 0) - Number(line.system_quantity); return <div key={line.id} className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_120px_140px_90px]"><div><div className="font-semibold text-slate-800">{line.item?.name}</div><div className="text-xs text-slate-400">{line.lot?.lot_no ? `Lot ${line.lot.lot_no}` : "Unallocated / product balance"}</div></div><div><div className="text-xs text-slate-400">System quantity</div><div className="min-h-11 rounded-lg bg-slate-50 px-3 py-2.5 font-semibold">{line.system_quantity}</div></div><Input label="Physical quantity" type="number" value={line.counted_quantity} set={(v) => setCount({ ...count, lines: count.lines.map((row) => row.id === line.id ? { ...row, counted_quantity: v } : row) })} required /><div className={`pb-3 text-right text-sm font-bold ${variance < 0 ? "text-rose-600" : variance > 0 ? "text-emerald-700" : "text-slate-400"}`}>{variance > 0 ? "+" : ""}{variance}</div></div>; })}</div><ModalActions busy={busy} onClose={onClose} saveLabel="Post variances" /></form></Modal>;
}

function StockModal({ item, lots, onClose }) {
  const [form, setForm] = useState({ movement_type: "out", quantity: 1, reason: "Issued for event", inventory_lot_id: "", lot_no: "", expires_at: "" }); const [log, setLog] = useState(null); const [busy, setBusy] = useState(false);
  const itemLots = lots.filter((lot) => String(lot.inventory_item_id) === String(item?.id) && Number(lot.available_quantity) > 0);
  useEffect(() => { if (item) { const availableLots = lots.filter((lot) => String(lot.inventory_item_id) === String(item.id) && Number(lot.available_quantity) > 0); setForm({ movement_type: "out", quantity: 1, reason: "Issued for event", inventory_lot_id: availableLots[0]?.id || "", lot_no: "", expires_at: "" }); ownerStockMovements(item.id).then(setLog); } }, [item, lots]); if (!item) return null;
  const incoming = ["in", "return"].includes(form.movement_type);
  const changeType = (movement_type) => setForm({ ...form, movement_type, inventory_lot_id: movement_type === "out" || movement_type === "adjust" ? itemLots[0]?.id || "" : "", lot_no: "", reason: movement_type === "out" ? "Issued for event" : movement_type === "adjust" ? "Stock write-off" : "Stock received" });
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await ownerAdjustStock(item.id, { ...form, inventory_lot_id: form.inventory_lot_id ? Number(form.inventory_lot_id) : null, quantity: Number(form.quantity) }); toast.success("Movement recorded with lot balance updated."); ownerStockMovements(item.id).then(setLog); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  return <Modal title={`${item.name} · movements`} onClose={onClose}><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2"><Select label="Movement" value={form.movement_type} set={changeType} options={[["in", "Stock in (+)"], ["return", "Return to stock (+)"], ["out", "Issue / use (−)"], ["adjust", "Write-off adjustment (−)"]]} /><Input label="Quantity" type="number" value={form.quantity} set={(v) => setForm({ ...form, quantity: v })} required />{item.track_lots && <Select label="Lot" value={form.inventory_lot_id} set={(v) => setForm({ ...form, inventory_lot_id: v })} options={[...(incoming ? [["", "Create new lot / batch"]] : []), ...itemLots.map((lot) => [lot.id, `${lot.lot_no} · ${lot.available_quantity} available`])]} required={!incoming} />}{item.track_lots && incoming && !form.inventory_lot_id && <><Input label="New lot / batch number" value={form.lot_no} set={(v) => setForm({ ...form, lot_no: v })} required /><Input label="Expiry date" type="date" value={form.expires_at} set={(v) => setForm({ ...form, expires_at: v })} /></>}<Input label="Reason" value={form.reason} set={(v) => setForm({ ...form, reason: v })} full /><ModalActions busy={busy} onClose={onClose} saveLabel="Record movement" /></form><div className="mt-5 max-h-72 divide-y overflow-y-auto">{!log ? <Loading rows={3} /> : log.map((movement) => <div key={movement.id} className="flex items-center justify-between py-3 text-sm"><div className="flex items-center gap-2">{["in", "return"].includes(movement.movement_type) ? <ArrowDownCircle className="h-4 w-4 text-emerald-500" /> : <ArrowUpCircle className="h-4 w-4 text-amber-500" />}<div><div className="font-semibold capitalize">{movement.movement_type} {movement.lot?.lot_no && `· ${movement.lot.lot_no}`}</div><div className="text-xs text-slate-400">{movement.reason}</div></div></div><div className="text-right"><div className="font-semibold">{movement.quantity}</div><div className="text-xs text-slate-400">bal {movement.balance_after}</div></div></div>)}</div></Modal>;
}

function Modal({ title, onClose, wide, children }) { return <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`max-h-[94dvh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6 ${wide ? "max-w-4xl" : "max-w-xl"}`}><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-bold text-slate-900">{title}</h2><button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>{children}</div></div>; }
function Input({ label, value, set, type = "text", required, full }) { return <label className={full ? "sm:col-span-2" : ""}><span className="text-xs font-semibold text-slate-600">{label}{required && <span className="text-rose-500"> *</span>}</span><input type={type} value={value ?? ""} onChange={(event) => set(event.target.value)} required={required} min={type === "number" ? 0 : undefined} step={type === "number" ? "0.01" : undefined} className="input mt-1 min-h-11" /></label>; }
function ComboInput({ label, value, set, options = [], placeholder, onCreate, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); // { name, value }
  const boxRef = useRef(null);
  const v = (value || "").trim();
  const known = options.some((o) => o.toLowerCase() === v.toLowerCase());
  const filtered = v ? options.filter((o) => o.toLowerCase().includes(v.toLowerCase())) : options;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setOpen(false); setEdit(null); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const create = async () => { if (!v || !onCreate) return; setBusy(true); try { await onCreate(v); } finally { setBusy(false); } };
  const rename = async () => { const nv = (edit.value || "").trim(); if (!nv || !onRename) return; setBusy(true); try { await onRename(edit.name, nv); if (value === edit.name) set(nv); setEdit(null); } finally { setBusy(false); } };
  const del = async (name) => { if (!onDelete) return; if (await onDelete(name)) { if (value === name) set(""); } };

  return <label ref={boxRef} className="relative block">
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    <div className="relative mt-1">
      <input value={value ?? ""} onChange={(e) => { set(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} className="input min-h-11 pr-10" autoComplete="off" />
      <button type="button" tabIndex={-1} onClick={() => setOpen((o) => !o)} className="absolute right-1 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /></button>
    </div>
    {open && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      {v && !known && onCreate && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={create} disabled={busy} className="mb-1 flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create “{v}”</button>}
      {!filtered.length && !(v && !known) && <p className="px-3 py-3 text-center text-xs text-slate-400">No entries yet — type to create.</p>}
      {filtered.map((o) => edit && edit.name === o
        ? <div key={o} className="flex items-center gap-1 p-1">
            <input autoFocus value={edit.value} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => setEdit({ ...edit, value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); rename(); } }} className="input min-h-9 flex-1 py-1 text-sm" />
            <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={rename} className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white"><Check className="h-4 w-4" /></button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setEdit(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
        : <div key={o} className="group flex items-center gap-1 rounded-lg px-1 hover:bg-slate-50">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { set(o); setOpen(false); }} className={`flex-1 truncate px-2 py-2 text-left text-sm ${o.toLowerCase() === v.toLowerCase() ? "font-semibold text-brand-700" : "text-slate-700"}`}>{o}</button>
            {onRename && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setEdit({ name: o, value: o })} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>}
            {onDelete && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => del(o)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>)}
    </div>}
  </label>;
}
function Select({ label, value, set, options, required }) { return <label><span className="text-xs font-semibold text-slate-600">{label}{required && <span className="text-rose-500"> *</span>}</span><select value={value ?? ""} onChange={(event) => set(event.target.value)} required={required} className="input mt-1 min-h-11">{options.map((option) => { const [value, label] = Array.isArray(option) ? option : [option, option]; return <option key={value} value={value}>{label}</option>; })}</select></label>; }
function TextArea({ label, value, set, full }) { return <label className={full ? "sm:col-span-2" : ""}><span className="text-xs font-semibold text-slate-600">{label}</span><textarea rows="3" value={value ?? ""} onChange={(event) => set(event.target.value)} className="input mt-1 resize-none" /></label>; }
function ModalActions({ busy, onClose, saveLabel = "Save" }) { return <div className="flex justify-end gap-2 pt-2 sm:col-span-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button><button disabled={busy} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : saveLabel}</button></div>; }
function SmallButton({ icon: Icon, children, danger, ...props }) { return <button {...props} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ${danger ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{Icon && <Icon className="h-3.5 w-3.5" />}{children}</button>; }
function filterRows(tab, data, query) { if (!data) return []; const map = { products: data.items, suppliers: data.suppliers, orders: data.purchase_orders, lots: data.lots, counts: data.stock_counts, returns: data.returns, damages: data.damages }; const rows = map[tab] || []; const q = query.trim().toLowerCase(); if (!q) return rows; return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q)); }
function emptyData() { return { summary: {}, items: [], suppliers: [], purchase_orders: [], lots: [], stock_counts: [], returns: [], damages: [] }; }
function apiError(error) { return error.response?.data?.errors ? Object.values(error.response.data.errors)[0][0] : error.response?.data?.message || "Request failed."; }
