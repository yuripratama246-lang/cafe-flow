import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw, ShoppingCart, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchOrders } from "@/lib/pos";
import { rupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/laporan")({ component: ReportsPage });

function ReportsPage() {
  const query = useQuery({ queryKey: ["orders", "report"], queryFn: () => fetchOrders({ limit: 500 }), refetchInterval: 30000 });
  const orders = query.data ?? [];
  const completed = orders.filter((o) => o.status === "completed");
  const omzet = completed.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const paid = completed.filter((o) => o.is_paid).reduce((sum, o) => sum + Number(o.total || 0), 0);
  const items = completed.reduce((sum, o) => sum + o.order_items.reduce((n, i) => n + i.quantity, 0), 0);

  return <AppShell title="Laporan" description="Ringkasan performa penjualan Cafe Flow" actions={<Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button>}>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="size-4" />Omzet selesai</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{rupiah(omzet)}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ShoppingCart className="size-4" />Transaksi</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{completed.length}</p><p className="text-xs text-muted-foreground">{items} item terjual</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm"><BarChart3 className="size-4" />Sudah dibayar</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{rupiah(paid)}</p></CardContent></Card>
    </div>
    <Card className="mt-4"><CardHeader><CardTitle>Transaksi terbaru</CardTitle></CardHeader><CardContent className="space-y-3">
      {completed.slice(0, 10).map((o) => <div key={o.id} className="flex items-center justify-between border-b pb-3 last:border-0"><div><p className="font-medium">#{o.order_no}</p><p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("id-ID")}</p></div><strong>{rupiah(o.total)}</strong></div>)}
      {completed.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Belum ada transaksi selesai.</p>}
    </CardContent></Card>
  </AppShell>;
}
