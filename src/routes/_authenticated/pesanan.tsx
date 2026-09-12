import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { RefreshCw, CheckCircle2, ChefHat, Clock3, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchOrders, updateOrderStatus, STATUS_LABEL, type OrderStatus } from "@/lib/pos";
import { rupiah, timeLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pesanan")({ component: OrdersPage });

const columns: { status: OrderStatus; icon: typeof Clock3 }[] = [
  { status: "new", icon: Clock3 },
  { status: "preparing", icon: ChefHat },
  { status: "ready", icon: CheckCircle2 },
  { status: "completed", icon: CheckCircle2 },
];

function OrdersPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["orders", "queue"], queryFn: () => fetchOrders({ limit: 100 }), refetchInterval: 10000 });
  const mutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatus(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }) });
  const orders = query.data ?? [];
  return <AppShell title="Pesanan" description="Antrean pesanan POS dan QR Menu" actions={<Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button>}>
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map(({ status, icon: Icon }) => <Card key={status} className="min-h-80">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Icon className="size-4 text-primary" />{STATUS_LABEL[status]}<Badge variant="secondary" className="ml-auto">{orders.filter(o => o.status === status).length}</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {orders.filter(o => o.status === status).map(o => <div key={o.id} className="rounded-xl border p-3">
            <div className="flex justify-between gap-2"><div><p className="font-semibold">#{o.order_no}</p><p className="text-xs text-muted-foreground">{o.source === "qr" ? "QR Menu" : "Kasir"}{o.restaurant_tables?.name ? ` · ${o.restaurant_tables.name}` : ""}</p></div><span className="text-xs text-muted-foreground">{timeLabel(o.created_at)}</span></div>
            <div className="my-3 space-y-1">{o.order_items.map(i => <div key={i.id} className="flex justify-between text-sm"><span>{i.quantity}× {i.product_name}</span><span>{rupiah(i.line_total)}</span></div>)}</div>
            <div className="flex items-center justify-between border-t pt-2"><strong>{rupiah(o.total)}</strong>{status !== "completed" && <Button size="sm" onClick={() => mutation.mutate({ id: o.id, status: status === "new" ? "preparing" : status === "preparing" ? "ready" : "completed" })}>{status === "new" ? "Proses" : status === "preparing" ? "Siapkan" : "Selesai"}</Button>}</div>
          </div>)}
          {orders.filter(o => o.status === status).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Kosong</p>}
        </CardContent>
      </Card>)}
    </div>
  </AppShell>;
}
