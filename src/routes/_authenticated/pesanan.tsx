import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, ChefHat, Clock3, Download, Printer, QrCode, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchOrders, updateOrderStatus, approveQrOrder, rejectQrOrder, PAYMENT_LABEL, STATUS_LABEL, type OrderStatus, type OrderWithItems } from "@/lib/pos";
import { rupiah, timeLabel } from "@/lib/format";
import { Receipt } from "@/components/Receipt";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pesanan")({ component: OrdersPage });
type Stage = "new" | "preparing" | "ready" | "history";
const stages: { id: Stage; title: string; icon: typeof Clock3; hint: string }[] = [
  { id: "new", title: "Baru", icon: Clock3, hint: "Pesanan masuk" },
  { id: "preparing", title: "Diproses", icon: ChefHat, hint: "Sedang dibuat" },
  { id: "ready", title: "Siap", icon: CheckCircle2, hint: "Siap disajikan" },
  { id: "history", title: "Riwayat", icon: CheckCircle2, hint: "Selesai & batal" },
];
function OrdersPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["orders", "queue"], queryFn: () => fetchOrders({ limit: 1000 }) });
  useEffect(() => {
    const channel = supabase.channel("orders-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void qc.invalidateQueries({ queryKey: ["orders"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => { void qc.invalidateQueries({ queryKey: ["orders"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => { void qc.invalidateQueries({ queryKey: ["orders"] }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);
  const [stage, setStage] = useState<Stage>("new");
  const [selected, setSelected] = useState<OrderWithItems | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<OrderWithItems | null>(null);
  const [cash, setCash] = useState("");
  const [confirmMethod, setConfirmMethod] = useState("qris");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const orders = query.data ?? [];
  const stageOrders = useMemo(() => ({
    new: orders.filter(o => o.status === "new"),
    preparing: orders.filter(o => o.status === "preparing"),
    ready: orders.filter(o => o.status === "ready"),
    history: orders.filter(o => ["completed", "cancelled"].includes(o.status) || o.payment_status === "rejected"),
  }), [orders]);
  const historyOrders = useMemo(() => stageOrders.history.filter(o => {
    const day = o.created_at.slice(0, 10);
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  }), [stageOrders.history, fromDate, toDate]);
  const approve = useMutation({
    mutationFn: ({ id, cashReceived, method }: { id: string; cashReceived?: number | null; method: string }) => approveQrOrder(id, cashReceived, method),
    onSuccess: () => { setSelected(null); setCash(""); void qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Pembayaran dikonfirmasi"); },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal mengonfirmasi pembayaran"),
  });
  const reject = useMutation({
    mutationFn: rejectQrOrder,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Pesanan ditolak"); },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal menolak pesanan"),
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Status pesanan diperbarui"); },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal memperbarui status"),
  });
  function openApproval(o: OrderWithItems) {
    setSelected(o);
    setConfirmMethod(o.payment_method === "cash" ? "cash" : "qris");
    setCash(o.payment_method === "cash" ? String(Math.ceil(Number(o.total) / 10000) * 10000) : "");
  }
  function submitApproval() {
    if (!selected) return;
    if (confirmMethod === "cash") {
      const amount = Number(cash);
      if (!Number.isFinite(amount) || amount < Number(selected.total)) { toast.error("Uang diterima belum mencukupi."); return; }
      approve.mutate({ id: selected.id, cashReceived: amount, method: confirmMethod });
    } else approve.mutate({ id: selected.id, cashReceived: null, method: confirmMethod });
  }
  function exportCsv() {
    const rows = [["No Pesanan", "Tanggal", "Sumber", "Meja", "Pelanggan", "Item", "Total", "Pembayaran", "Metode", "Status"]];
    historyOrders.forEach(o => rows.push([
      String(o.order_no), new Date(o.created_at).toLocaleString("id-ID"), o.source === "qr" ? "QR Menu" : "Kasir",
      o.restaurant_tables?.name ?? "-", o.customer_name ?? "-", o.order_items.map(i => `${i.quantity}x ${i.product_name}`).join("; "),
      String(o.total), o.payment_status, PAYMENT_LABEL[o.payment_method ?? "cash"] ?? o.payment_method ?? "-",
      STATUS_LABEL[o.status] ?? o.status,
    ]));
    const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `riwayat-pesanan-${fromDate || "awal"}-${toDate || "terbaru"}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  const visibleOrders = stage === "history" ? historyOrders : stageOrders[stage];
  return <AppShell title="Pesanan" description="Pantau pesanan masuk dan alihkan tahapnya secara real-time">
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {stages.map(({ id, title, icon: Icon, hint }) => {
          const count = id === "history" ? stageOrders.history.length : stageOrders[id].length;
          return <button key={id} onClick={() => setStage(id)} className={`min-w-0 rounded-xl border px-1.5 py-2.5 text-left transition sm:px-3 sm:py-3 ${stage === id ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "bg-card hover:bg-muted/60"}`}>
            <div className="flex items-center justify-between gap-1"><Icon className={`size-4 shrink-0 sm:size-[18px] ${stage === id ? "text-primary" : "text-muted-foreground"}`} /><span className={`text-lg font-bold tabular-nums sm:text-xl ${stage === id ? "text-primary" : ""}`}>{count}</span></div>
            <p className="mt-1 truncate text-[11px] font-semibold sm:text-sm">{title}</p><p className="hidden truncate text-[10px] text-muted-foreground sm:block">{hint}</p>
          </button>;
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><h2 className="text-base font-semibold sm:text-lg">{stages.find(s => s.id === stage)?.title}</h2><p className="text-xs text-muted-foreground">{stage === "new" ? "Order baru akan muncul otomatis di sini." : stage === "preparing" ? "Pesanan yang sedang dibuat." : stage === "ready" ? "Pesanan menunggu disajikan/diambil." : "Pesanan selesai, dibatalkan, atau ditolak."}</p></div>
        {stage === "history" && <Button size="sm" variant="outline" onClick={exportCsv} disabled={!historyOrders.length}><Download className="mr-1.5 size-4" />Export CSV</Button>}
      </div>
      {stage === "history" && <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-2.5 sm:flex sm:items-end sm:gap-3"><div className="min-w-0"><Label className="mb-1 block text-xs">Dari tanggal</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 text-xs sm:w-40" /></div><div className="min-w-0"><Label className="mb-1 block text-xs">Sampai tanggal</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 text-xs sm:w-40" /></div><Button size="sm" variant="ghost" className="col-span-2 sm:mb-0.5 sm:w-fit" onClick={() => { setFromDate(""); setToDate(""); }}>Reset filter</Button><span className="col-span-2 text-[11px] text-muted-foreground sm:ml-auto sm:col-span-1">{historyOrders.length} pesanan</span></div>}
      {query.isLoading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Memuat pesanan…</CardContent></Card> : visibleOrders.length === 0 ? <Card><CardContent className="flex flex-col items-center py-10 text-center"><div className="mb-2 rounded-full bg-muted p-3"><Clock3 className="size-5 text-muted-foreground" /></div><p className="text-sm font-medium">{stage === "new" ? "Belum ada pesanan baru" : stage === "history" ? "Belum ada riwayat pesanan" : "Belum ada pesanan di tahap ini"}</p><p className="mt-1 text-xs text-muted-foreground">Pesanan akan tampil di sini otomatis.</p></CardContent></Card> :
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleOrders.map(o => {
            const unpaidQr = o.source === "qr" && o.status === "new" && !o.is_paid && o.payment_status !== "rejected";
            const rejected = o.payment_status === "rejected";
            const isHistory = stage === "history";
            return <article key={o.id} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex items-start justify-between gap-2 border-b px-3 py-2">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-bold">#{o.order_no}</span><Badge className={`px-1.5 py-0 text-[10px] ${unpaidQr ? "bg-red-600 hover:bg-red-600" : o.is_paid ? "bg-emerald-600 hover:bg-emerald-600" : ""}`} variant={unpaidQr || o.is_paid ? "default" : "secondary"}>{rejected ? "Ditolak" : unpaidQr ? "Belum bayar" : o.is_paid ? "Lunas" : STATUS_LABEL[o.status]}</Badge></div><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{o.source === "qr" ? "QR Ordering" : "Kasir"}{o.restaurant_tables?.name ? ` · ${o.restaurant_tables.name}` : ""}{o.customer_name ? ` · ${o.customer_name}` : ""}</p></div>
                <div className="shrink-0 text-right"><p className="text-[10px] text-muted-foreground">{timeLabel(o.created_at)}</p><p className="mt-0.5 text-sm font-bold tabular-nums">{rupiah(o.total)}</p></div>
              </div>
              <div className="space-y-1 px-3 py-2">
                {o.order_items.slice(0, 4).map(i => <div key={i.id} className="flex min-w-0 items-start justify-between gap-2 text-xs"><span className="min-w-0 truncate"><b className="mr-1 text-muted-foreground">{i.quantity}×</b>{i.product_name}{i.note ? <span className="block truncate pl-5 text-[10px] text-muted-foreground">Catatan: {i.note}</span> : null}</span><span className="shrink-0 text-muted-foreground">{rupiah(i.line_total)}</span></div>)}
                {o.order_items.length > 4 && <p className="text-[10px] text-muted-foreground">+{o.order_items.length - 4} item lainnya</p>}
                {o.notes && <p className="truncate rounded-md bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground">Catatan order: {o.notes}</p>}
              </div>
              <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2"><div className="min-w-0"><p className="truncate text-[10px] text-muted-foreground">{PAYMENT_LABEL[o.payment_method ?? "cash"] ?? o.payment_method ?? "Cash"}</p><p className="text-[10px] font-medium">{o.is_paid ? "Pembayaran lunas" : rejected ? "Pembayaran ditolak" : "Menunggu pembayaran"}</p></div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Cetak struk" onClick={() => setReceiptOrder(o)}><Printer className="size-3.5" /></Button>
                  {unpaidQr && <><Button variant="outline" size="sm" className="h-8 px-2 text-[11px]" disabled={reject.isPending || approve.isPending} onClick={() => reject.mutate(o.id)}><XCircle className="mr-1 size-3" />Tolak</Button><Button size="sm" className="h-8 px-2 text-[11px]" onClick={() => openApproval(o)}><ShieldCheck className="mr-1 size-3" />Tandai bayar</Button></>}
                  {!isHistory && !unpaidQr && stage === "new" && <Button size="sm" className="h-8 px-2 text-[11px]" disabled={!o.is_paid || move.isPending} onClick={() => move.mutate({ id: o.id, status: "preparing" })}>Mulai proses</Button>}
                  {stage === "preparing" && <Button size="sm" className="h-8 px-2 text-[11px]" onClick={() => move.mutate({ id: o.id, status: "ready" })}>Tandai siap</Button>}
                  {stage === "ready" && <Button size="sm" className="h-8 px-2 text-[11px]" onClick={() => move.mutate({ id: o.id, status: "completed" })}>Selesaikan</Button>}
                </div>
              </div>
            </article>;
          })}
        </div>}
    </div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setCash(""); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />Konfirmasi pembayaran</DialogTitle><DialogDescription>Periksa total dan pastikan pembayaran sudah diterima.</DialogDescription></DialogHeader>
        {selected && <div className="space-y-3"><div className="rounded-xl border bg-muted/30 p-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Order</span><b>#{selected.order_no}</b></div><div className="mt-2 text-sm"><span className="text-muted-foreground">Metode customer: </span><b>{PAYMENT_LABEL[selected.payment_method ?? "cash"] ?? selected.payment_method}</b></div><div className="mt-3 space-y-1.5"><Label htmlFor="confirm-payment-method">Konfirmasi sebagai metode</Label><select id="confirm-payment-method" value={confirmMethod} onChange={e => setConfirmMethod(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="cash">Cash / Tunai</option><option value="qris">QRIS</option><option value="bank_transfer">Transfer Bank</option><option value="ewallet">E-Wallet</option><option value="card">Kartu</option></select></div><div className="mt-3 flex justify-between border-t pt-3"><span className="font-medium">Total tagihan</span><b className="text-lg text-primary">{rupiah(selected.total)}</b></div></div>
        {confirmMethod === "cash" ? <div className="space-y-2"><Label htmlFor="approval-cash">Uang diterima</Label><Input id="approval-cash" inputMode="numeric" value={cash} onChange={e => setCash(e.target.value.replace(/[^0-9]/g, ""))} className="h-11 text-lg" /><div className="flex justify-between rounded-lg bg-muted/60 p-3 text-sm"><span>Kembalian</span><b>{rupiah(Math.max((Number(cash) || 0) - Number(selected.total), 0))}</b></div></div> : <div className="rounded-lg bg-primary/5 p-3 text-xs">Pastikan dana dari metode pembayaran customer sudah masuk sebelum konfirmasi.</div>}</div>}
        <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => { setSelected(null); setCash(""); }}>Batal</Button><Button disabled={approve.isPending} onClick={submitApproval}>{approve.isPending ? "Memproses…" : "Konfirmasi bayar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!receiptOrder} onOpenChange={open => !open && setReceiptOrder(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm"><DialogHeader><DialogTitle>Struk pesanan {receiptOrder ? `#${receiptOrder.order_no}` : ""}</DialogTitle></DialogHeader>{receiptOrder ? <Receipt order={receiptOrder} onClose={() => setReceiptOrder(null)} /> : null}</DialogContent></Dialog>
  </AppShell>;
}
