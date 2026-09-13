import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, ChefHat, Clock3, XCircle, Banknote, QrCode } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchOrders, updateOrderStatus, approveQrOrder, rejectQrOrder, PAYMENT_LABEL, STATUS_LABEL, type OrderStatus, type OrderWithItems } from "@/lib/pos";
import { rupiah, timeLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pesanan")({ component: OrdersPage });
const columns: { status: OrderStatus; icon: typeof Clock3 }[] = [{ status: "preparing", icon: ChefHat }, { status: "ready", icon: CheckCircle2 }];

function OrdersPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["orders", "queue"], queryFn: () => fetchOrders({ limit: 100 }), refetchInterval: 5000 });
  const approve = useMutation({ mutationFn: ({ id, cash }: { id: string; cash?: number | null }) => approveQrOrder(id, cash), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["orders"] }); } });
  const reject = useMutation({ mutationFn: rejectQrOrder, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["orders"] }); } });
  const move = useMutation({ mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status), onSuccess: () => void qc.invalidateQueries({ queryKey: ["orders"] }) });
  const orders = query.data ?? [];
  const incoming = orders.filter((o) => o.source === "qr" && o.status === "new" && !o.is_paid);

  function confirmPayment(order: OrderWithItems) {
    if (order.payment_method === "cash") {
      const raw = window.prompt(`Uang diterima untuk #${order.order_no} (total ${rupiah(order.total)}):`, String(order.total));
      if (raw === null) return;
      const cash = Number(raw);
      if (!Number.isFinite(cash) || cash < order.total) { window.alert("Uang diterima kurang dari total pesanan."); return; }
      approve.mutate({ id: order.id, cash });
      return;
    }
    approve.mutate({ id: order.id, cash: null });
  }

  return <AppShell title="Pesanan" description="Order masuk menunggu pembayaran dan antrean proses" actions={<Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button>}>
    <div className="space-y-5">
      <section><div className="mb-3 flex items-center gap-2"><Clock3 className="size-5 text-primary" /><h2 className="text-base font-semibold">Order masuk</h2><Badge variant="secondary">{incoming.length}</Badge></div>{incoming.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Belum ada order QR yang menunggu pembayaran.</CardContent></Card> : <div className="grid gap-3 lg:grid-cols-2">{incoming.map((o) => <Card key={o.id} className="border-primary/30"><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">#{o.order_no}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{o.restaurant_tables?.name ?? "Tanpa meja"} · {o.customer_name || "Walk-in"} · {timeLabel(o.created_at)}</p></div><Badge variant="outline" className="gap-1">{o.payment_method === "qris" ? <QrCode className="size-3" /> : <Banknote className="size-3" />}{PAYMENT_LABEL[o.payment_method ?? "cash"]}</Badge></div></CardHeader><CardContent><div className="space-y-1">{o.order_items.map((i) => <div key={i.id} className="flex justify-between text-sm"><span>{i.quantity}× {i.product_name}</span><span>{rupiah(i.line_total)}</span></div>)}</div><div className="mt-3 flex items-center justify-between border-t pt-3"><div><p className="text-xs text-muted-foreground">Status pembayaran</p><p className="text-sm font-semibold">{PAYMENT_LABEL[o.payment_status]}</p><p className="text-lg font-bold">{rupiah(o.total)}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={approve.isPending || reject.isPending} onClick={() => reject.mutate(o.id)}><XCircle className="mr-1 size-4" />Tolak</Button><Button size="sm" disabled={approve.isPending || reject.isPending} onClick={() => confirmPayment(o)}><CheckCircle2 className="mr-1 size-4" />Konfirmasi bayar</Button></div></div></CardContent></Card>)}</div>}</section>
      <div className="grid gap-4 xl:grid-cols-2">{columns.map(({ status, icon: Icon }) => { const list = orders.filter((o) => o.status === status); return <Card key={status}><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Icon className="size-4 text-primary" />{STATUS_LABEL[status]}<Badge variant="secondary" className="ml-auto">{list.length}</Badge></CardTitle></CardHeader><CardContent className="space-y-3">{list.map((o) => <div key={o.id} className="rounded-xl border p-3"><div className="flex justify-between"><div><p className="font-semibold">#{o.order_no}</p><p className="text-xs text-muted-foreground">{o.source === "qr" ? "QR Menu" : "Kasir"}{o.restaurant_tables?.name ? ` · ${o.restaurant_tables.name}` : ""}</p></div><span className="text-xs text-muted-foreground">{timeLabel(o.created_at)}</span></div><div className="my-3 space-y-1">{o.order_items.map((i) => <div key={i.id} className="flex justify-between text-sm"><span>{i.quantity}× {i.product_name}</span><span>{rupiah(i.line_total)}</span></div>)}</div><div className="flex items-center justify-between border-t pt-2"><div><strong>{rupiah(o.total)}</strong><p className="text-xs text-muted-foreground">{o.is_paid ? `Pembayaran: ${PAYMENT_LABEL[o.payment_method ?? "cash"]}` : "Belum dibayar"}</p></div>{status === "preparing" ? <Button size="sm" onClick={() => move.mutate({ id: o.id, status: "ready" })}>Siapkan</Button> : <Button size="sm" onClick={() => move.mutate({ id: o.id, status: "completed" })}>Selesai</Button>}</div></div>)}{!list.length && <p className="py-8 text-center text-sm text-muted-foreground">Kosong</p>}</CardContent></Card>; })}</div>
    </div>
  </AppShell>;
}
