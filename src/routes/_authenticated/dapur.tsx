import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Clock3, CheckCircle2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchOrders, updateOrderStatus, STATUS_LABEL, type OrderStatus } from "@/lib/pos";
import { rupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dapur")({ component: KitchenPage });
const COLUMNS: { status: OrderStatus; title: string }[] = [{ status: "new", title: "Pesanan Baru" }, { status: "preparing", title: "Sedang Dibuat" }, { status: "ready", title: "Siap Disajikan" }];

function KitchenPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["orders", "kitchen"], queryFn: () => fetchOrders({ limit: 100 }), refetchInterval: 5000 });
  const orders = query.data ?? [];
  const move = useMutation({ mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status), onSuccess: () => void qc.invalidateQueries({ queryKey: ["orders", "kitchen"] }) });
  return <AppShell title="Dapur / Kitchen Display" description="Pantau tiket pesanan secara real-time" actions={<Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button>}>
    <div className="grid gap-4 lg:grid-cols-3">{COLUMNS.map((column) => { const items = orders.filter((o) => o.status === column.status); return <section key={column.status} className="min-h-[60vh] rounded-2xl bg-muted/30 p-3"><div className="mb-3 flex items-center justify-between px-2"><div className="flex items-center gap-2"><ChefHat className="size-5" /><h2 className="font-semibold">{column.title}</h2></div><Badge variant="secondary">{items.length}</Badge></div><div className="space-y-3">{items.map((order) => <Card key={order.id}><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">#{order.order_no}</CardTitle><Badge variant="outline">{order.source === "qr" ? "QR" : "Kasir"}</Badge></div><p className="text-xs text-muted-foreground"><Clock3 className="mr-1 inline size-3" />{new Date(order.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}{order.restaurant_tables?.name ? ` · ${order.restaurant_tables.name}` : ""}</p></CardHeader><CardContent className="space-y-3"><div className="space-y-2">{order.order_items.map((item) => <div key={item.id} className="flex gap-2 text-sm"><span className="font-bold">{item.quantity}×</span><div className="min-w-0 flex-1"><p className="font-medium">{item.product_name}</p>{item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}</div></div>)}</div><p className="border-t pt-2 text-sm font-semibold">{rupiah(order.total)}</p>{column.status === "new" && <Button className="w-full" onClick={() => move.mutate({ id: order.id, status: "preparing" })}>Mulai dibuat</Button>}{column.status === "preparing" && <Button className="w-full" onClick={() => move.mutate({ id: order.id, status: "ready" })}>Tandai siap</Button>}{column.status === "ready" && <Button className="w-full" onClick={() => move.mutate({ id: order.id, status: "completed" })}><CheckCircle2 className="mr-2 size-4" />Selesai</Button>}</CardContent></Card>)}{!items.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada tiket.</div>}</div></section>})}</div>
  </AppShell>;
}
