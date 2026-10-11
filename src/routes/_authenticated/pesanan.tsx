import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CheckCircle2, ChefHat, Clock3, Download, Eye, Printer, QrCode, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchOrders, fetchPublicPaymentMethods, updateOrderStatus, approveQrOrder, rejectQrOrder, PAYMENT_LABEL, STATUS_LABEL, type OrderStatus, type OrderWithItems, type PaymentMethodConfig } from "@/lib/pos";
import { rupiah, timeLabel } from "@/lib/format";
import { Receipt } from "@/components/Receipt";
import { supabase } from "@/integrations/supabase/client";
import { printKitchenTicket, getPrinterConfig } from "@/lib/bluetooth-printer";

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
  const paymentMethodsQuery = useQuery({ queryKey: ["public-payment-methods"], queryFn: fetchPublicPaymentMethods });
  const paymentMethods = (paymentMethodsQuery.data ?? []).filter((m: PaymentMethodConfig) => m.is_active !== false);
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
  const [itemsOrder, setItemsOrder] = useState<OrderWithItems | null>(null);
  const [cash, setCash] = useState("");
  const [confirmMethod, setConfirmMethod] = useState("qris");
  const [selectedPaymentCode, setSelectedPaymentCode] = useState("qris");
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
    onSuccess: () => { setSelected(null); setCash(""); setStage("preparing"); void qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Pembayaran dikonfirmasi — pesanan dipindahkan ke Diproses"); },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal mengonfirmasi pembayaran"),
  });
  const reject = useMutation({
    mutationFn: rejectQrOrder,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Pesanan ditolak"); },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal menolak pesanan"),
  });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status),
    onSuccess: (_data, variables) => { setStage(variables.status === "preparing" ? "preparing" : variables.status === "ready" ? "ready" : variables.status === "completed" || variables.status === "cancelled" ? "history" : "new"); if (variables.status === "preparing") { const order = (query.data ?? []).find(o => o.id === variables.id); if (order) void (async () => { const db = supabase as any; const { data: auth } = await supabase.auth.getUser(); const printer = getPrinterConfig().kitchen; let job: any = null; try { if (!auth.user) throw new Error("Sesi login tidak ditemukan."); if (!printer) throw new Error("Printer dapur belum diatur."); const payload = { order_no: order.order_no, created_at: order.created_at, restaurant_tables: order.restaurant_tables, order_items: order.order_items.map(i => ({ product_name: i.product_name, quantity: i.quantity, note: i.note })), notes: order.notes }; const { data, error } = await db.from("printer_print_jobs").insert({ owner_id: auth.user.id, order_id: order.id, order_no: String(order.order_no), printer_role: "kitchen", document_type: "kitchen_ticket", printer_name: printer.name, bluetooth_address: printer.address, status: "queued", attempt_count: 0, document_payload: payload }).select("id").single(); if (error) throw error; job = data; await db.from("printer_print_jobs").update({ status: "printing", attempt_count: 1 }).eq("id", job.id); await printKitchenTicket(payload); await db.from("printer_print_jobs").update({ status: "success", printed_at: new Date().toISOString() }).eq("id", job.id); toast.success("Tiket dapur terkirim ke printer."); } catch (err) { if (job) await db.from("printer_print_jobs").update({ status: "failed", error_message: err instanceof Error ? err.message : "Print gagal" }).eq("id", job.id); toast.error(err instanceof Error ? "Tiket dapur gagal dicetak: " + err.message : "Tiket dapur gagal dicetak."); } })(); } void qc.invalidateQueries({ queryKey: ["orders"] }); toast.success(variables.status === "ready" ? "Pesanan dipindahkan ke Siap" : variables.status === "completed" ? "Pesanan selesai — dipindahkan ke Riwayat" : "Status pesanan diperbarui"); },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal memperbarui status"),
  });
  function openApproval(o: OrderWithItems) {
    setSelected(o);
    const initialMethod = o.payment_method === "cash" ? "cash" : "qris";
    setConfirmMethod(initialMethod);
    setSelectedPaymentCode(initialMethod);
    setCash(o.payment_method === "cash" ? String(Math.ceil(Number(o.total) / 10000) * 10000) : "");
  }
  function submitApproval() {
    if (!selected) return;
    const chosen = confirmMethod === "cash" ? "cash" : confirmMethod === "qris" ? (paymentMethods.find(m => m.type === "qris" && m.code === selectedPaymentCode)?.code ?? "qris") : selectedPaymentCode;
    if ((confirmMethod === "bank_transfer" || confirmMethod === "ewallet") && !paymentMethods.some(m => m.type === confirmMethod && m.code === selectedPaymentCode)) { toast.error("Pilih rekening atau e-wallet tujuan terlebih dahulu."); return; }
    if (confirmMethod === "cash") {
      const amount = Number(cash);
      if (!Number.isFinite(amount) || amount < Number(selected.total)) { toast.error("Uang diterima belum mencukupi."); return; }
      approve.mutate({ id: selected.id, cashReceived: amount, method: chosen });
    } else approve.mutate({ id: selected.id, cashReceived: null, method: chosen });
  }
  function exportCsv() {
    const rows = [["No Pesanan", "Tanggal", "Sumber", "Meja", "Pelanggan", "Item", "Total", "Pembayaran", "Metode", "Status"]];
    historyOrders.forEach(o => rows.push([
      String(o.order_no), new Date(o.created_at).toLocaleString("id-ID"), o.source === "qr" ? "QR Menu" : "Kasir",
      o.restaurant_tables?.name ?? "-", o.customer_name ?? "-", o.order_items.map(i => `${i.quantity}x ${i.product_name}`).join("; "),
      String(o.total), o.payment_status, PAYMENT_LABEL[o.payment_method ?? "cash"] ?? o.payment_method ?? "-",
      STATUS_LABEL[o.status] ?? o.status,
    ]));
    const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\\r\\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `riwayat-pesanan-${fromDate || "awal"}-${toDate || "terbaru"}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  const visibleOrders = stage === "history" ? historyOrders : stageOrders[stage];
  return <AppShell title="Pesanan" description="Pantau pesanan masuk dan alihkan tahapnya secara real-time">
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
        {stages.map(({ id, title, icon: Icon, hint }) => {
          const count = id === "history" ? stageOrders.history.length : stageOrders[id].length;
          return <button key={id} onClick={() => setStage(id)} className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition sm:px-3 ${stage === id ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "bg-card hover:bg-muted/60"}`}>
            <Icon className={`size-4 shrink-0 ${stage === id ? "text-primary" : "text-muted-foreground"}`} />
            <span className="min-w-0 flex-1"><span className={`block truncate text-xs font-semibold sm:text-sm ${stage === id ? "text-primary" : ""}`}>{title}</span><span className="hidden truncate text-[10px] text-muted-foreground sm:block">{hint}</span></span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
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
                {o.order_items.slice(0, 3).map(i => <div key={i.id} className="flex min-w-0 items-start justify-between gap-2 text-xs"><span className="min-w-0"><span className="block truncate"><b className="mr-1 text-muted-foreground">{i.quantity}×</b>{i.product_name}</span>{i.note ? <span className="mt-0.5 block whitespace-normal break-words pl-5 text-[10px] leading-snug text-muted-foreground">Catatan: {i.note}</span> : null}</span><span className="shrink-0 text-muted-foreground">{rupiah(i.line_total)}</span></div>)}
                {o.order_items.length > 3 && <button type="button" onClick={() => setItemsOrder(o)} className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/5"><Eye className="size-3.5" />Lihat semua {o.order_items.length} item ({o.order_items.length - 3} lainnya)</button>}
                {o.notes && <p className="whitespace-normal break-words rounded-md bg-muted/60 px-2 py-1 text-[10px] leading-snug text-muted-foreground">Catatan order: {o.notes}</p>}
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
    <Dialog open={!!itemsOrder} onOpenChange={open => !open && setItemsOrder(null)}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Detail item pesanan #{itemsOrder?.order_no}</DialogTitle><DialogDescription>{itemsOrder?.customer_name ? `Pesanan dari ${itemsOrder.customer_name} · ` : ""}{itemsOrder?.order_items.length ?? 0} item. Scroll untuk melihat semua item dan catatan customer.</DialogDescription></DialogHeader>{itemsOrder && <div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">{itemsOrder.order_items.map((i, index) => <div key={i.id} className="rounded-lg border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium"><span className="mr-1.5 text-muted-foreground">{index + 1}.</span>{i.quantity}× {i.product_name}</p>{i.note && <p className="mt-1 whitespace-normal break-words text-xs text-muted-foreground">Catatan: {i.note}</p>}</div><p className="shrink-0 text-sm font-medium">{rupiah(i.line_total)}</p></div></div>)}</div>}<DialogFooter><Button onClick={() => setItemsOrder(null)}>Tutup</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) { setSelected(null); setCash(""); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />Konfirmasi pembayaran</DialogTitle><DialogDescription>Periksa total dan pastikan pembayaran sudah diterima.</DialogDescription></DialogHeader>
        {selected && <div className="space-y-3"><div className="rounded-xl border bg-muted/30 p-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Order</span><b>#{selected.order_no}</b></div><div className="mt-2 text-sm"><span className="text-muted-foreground">Metode customer: </span><b>{PAYMENT_LABEL[selected.payment_method ?? "cash"] ?? selected.payment_method}</b></div><div className="mt-3 space-y-1.5"><Label htmlFor="confirm-payment-method">Metode pembayaran kasir</Label><select id="confirm-payment-method" value={confirmMethod} onChange={e => { const method = e.target.value; setConfirmMethod(method); const first = paymentMethods.find(m => m.type === method); setSelectedPaymentCode(method === "cash" ? "cash" : first?.code ?? method); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="cash">Tunai / Cash</option><option value="ewallet">E-Wallet</option><option value="bank_transfer">Transfer Bank</option><option value="qris">QRIS</option></select></div>
        {(confirmMethod === "bank_transfer" || confirmMethod === "ewallet" || confirmMethod === "qris") && <div className="mt-3 space-y-1.5"><Label htmlFor="confirm-payment-account">{confirmMethod === "bank_transfer" ? "Pilih rekening tujuan" : confirmMethod === "ewallet" ? "Pilih e-wallet tujuan" : "Pilih metode QRIS"}</Label><select id="confirm-payment-account" value={selectedPaymentCode} onChange={e => setSelectedPaymentCode(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>— Pilih tujuan pembayaran —</option>{paymentMethods.filter(m => confirmMethod === "bank_transfer" ? m.type === "bank_transfer" : confirmMethod === "ewallet" ? m.type === "ewallet" : m.type === "qris").map(m => <option key={m.id ?? m.code} value={m.code}>{[m.provider || m.name, m.account_number, m.account_name ? `a.n. ${m.account_name}` : null].filter(Boolean).join(" · ")}</option>)}</select>{paymentMethods.filter(m => confirmMethod === "bank_transfer" ? m.type === "bank_transfer" : confirmMethod === "ewallet" ? m.type === "ewallet" : m.type === "qris").length === 0 && <p className="text-xs text-destructive">Belum ada metode aktif untuk pilihan ini. Tambahkan di Pengaturan → Metode Pembayaran.</p>}</div>}<div className="mt-3 flex justify-between border-t pt-3"><span className="font-medium">Total tagihan</span><b className="text-lg text-primary">{rupiah(selected.total)}</b></div></div>
        {confirmMethod === "cash" ? <div className="space-y-2"><Label htmlFor="approval-cash">Uang diterima</Label><Input id="approval-cash" inputMode="numeric" value={cash} onChange={e => setCash(e.target.value.replace(/[^0-9]/g, ""))} className="h-11 text-lg" /><div className="flex justify-between rounded-lg bg-muted/60 p-3 text-sm"><span>Kembalian</span><b>{rupiah(Math.max((Number(cash) || 0) - Number(selected.total), 0))}</b></div></div> : <div className="rounded-lg bg-primary/5 p-3 text-xs">Pastikan dana dari metode pembayaran customer sudah masuk sebelum konfirmasi.</div>}</div>}
        <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => { setSelected(null); setCash(""); }}>Batal</Button><Button disabled={approve.isPending} onClick={submitApproval}>{approve.isPending ? "Memproses…" : "Konfirmasi bayar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!receiptOrder} onOpenChange={open => !open && setReceiptOrder(null)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm"><DialogHeader><DialogTitle>Struk pesanan {receiptOrder ? `#${receiptOrder.order_no}` : ""}</DialogTitle></DialogHeader>{receiptOrder ? <Receipt order={receiptOrder} onClose={() => setReceiptOrder(null)} /> : null}</DialogContent></Dialog>
  </AppShell>;
}
