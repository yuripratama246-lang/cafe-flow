import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CreditCard, RefreshCw, ShoppingCart, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchOrders, PAYMENT_LABEL } from "@/lib/pos";
import { rupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/laporan")({ component: ReportsPage });

type Point = { label: string; value: number };

function ReportsPage() {
  const query = useQuery({ queryKey: ["orders", "report"], queryFn: () => fetchOrders({ limit: 500 }), refetchInterval: 30000 });
  const orders = query.data ?? [];
  const completed = orders.filter((o) => o.status === "completed");
  const omzet = completed.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const paid = completed.filter((o) => o.is_paid).reduce((sum, o) => sum + Number(o.total || 0), 0);
  const items = completed.reduce((sum, o) => sum + o.order_items.reduce((n, i) => n + i.quantity, 0), 0);
  const average = completed.length ? omzet / completed.length : 0;

  const dailySales = useMemo<Point[]>(() => {
    const map = new Map<string, number>();
    completed.forEach((o) => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + Number(o.total || 0));
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([key, value]) => {
      const [, month, day] = key.split("-").map(Number);
      return { label: `${day}/${month + 1}`, value };
    });
  }, [completed]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    completed.forEach((o) => o.order_items.forEach((item) => {
      const current = map.get(item.product_name) ?? { name: item.product_name, qty: 0, revenue: 0 };
      current.qty += item.quantity;
      current.revenue += Number(item.line_total || 0);
      map.set(item.product_name, current);
    }));
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [completed]);

  const payments = useMemo(() => {
    const map = new Map<string, number>();
    completed.filter((o) => o.is_paid).forEach((o) => o.payments?.forEach((p) => map.set(p.method, (map.get(p.method) ?? 0) + Number(p.amount || 0))));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [completed]);

  const maxDaily = Math.max(...dailySales.map((p) => p.value), 1);
  const maxProduct = Math.max(...topProducts.map((p) => p.qty), 1);
  const paymentTotal = payments.reduce((s, [, value]) => s + value, 0) || 1;

  return (
    <AppShell title="Laporan Penjualan" description="Pantau performa penjualan dan pola transaksi Cafe Flow" actions={<Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[["Penjualan", rupiah(omzet), Wallet], ["Transaksi", String(completed.length), ShoppingCart], ["Item terjual", String(items), BarChart3], ["Rata-rata transaksi", rupiah(average), CreditCard]].map(([label, value, Icon]) => {
            const IconComponent = Icon as typeof Wallet;
            return <Card key={String(label)} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs text-muted-foreground">{label}</p><p className="num mt-1 text-2xl font-semibold tracking-tight">{value}</p></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><IconComponent className="size-5" /></div></CardContent></Card>;
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2"><CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Tren penjualan</CardTitle><p className="mt-1 text-xs text-muted-foreground">Omzet 7 hari terakhir yang tersedia</p></div><Badge variant="secondary">{rupiah(paid)} dibayar</Badge></CardHeader><CardContent>
            {dailySales.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">Belum ada data penjualan.</p> : <div className="relative h-64 pt-5"><div className="pointer-events-none absolute inset-x-0 top-5 bottom-8 flex flex-col justify-between">{[0,1,2,3].map((i) => <div key={i} className="border-t border-dashed border-border" />)}</div><div className="relative z-10 flex h-full items-end gap-2 px-1 pb-8">{dailySales.map((point) => <div key={point.label} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"><div className="relative flex h-full items-end"><div className="w-full rounded-t-lg bg-primary/75 transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:bg-primary" style={{ height: `${Math.max((point.value / maxDaily) * 100, 4)}%` }}><span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[10px] text-background group-hover:block">{rupiah(point.value)}</span></div></div><span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">{point.label}</span></div>)}</div></div>}
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-base">Metode pembayaran</CardTitle><p className="text-xs text-muted-foreground">Distribusi omzet yang sudah dibayar</p></CardHeader><CardContent className="space-y-4">{payments.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Belum ada pembayaran.</p> : payments.map(([method, amount]) => { const pct = Math.round((amount / paymentTotal) * 100); return <div key={method}><div className="flex items-center justify-between text-sm"><span>{PAYMENT_LABEL[method] ?? method}</span><span className="num font-medium">{pct}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} /></div><p className="num mt-1 text-[11px] text-muted-foreground">{rupiah(amount)}</p></div>; })}</CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Produk terlaris</CardTitle><p className="text-xs text-muted-foreground">Ranking berdasarkan jumlah item</p></CardHeader><CardContent className="space-y-4">{topProducts.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Belum ada produk terjual.</p> : topProducts.map((product, index) => <div key={product.name} className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><span className="truncate text-sm font-medium">{product.name}</span><span className="num text-xs font-semibold">{product.qty} item</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75 transition-all duration-700" style={{ width: `${Math.max((product.qty / maxProduct) * 100, 5)}%` }} /></div></div></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Ringkasan kas</CardTitle><p className="text-xs text-muted-foreground">Status pembayaran dari data laporan</p></CardHeader><CardContent className="space-y-5"><div className="flex items-center justify-between border-b pb-4"><span className="text-sm text-muted-foreground">Total penjualan</span><span className="num font-semibold">{rupiah(omzet)}</span></div><div className="flex items-center justify-between border-b pb-4"><span className="text-sm text-muted-foreground">Sudah dibayar</span><span className="num font-semibold">{rupiah(paid)}</span></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Belum dibayar</span><span className="num font-semibold">{rupiah(Math.max(omzet - paid, 0))}</span></div></CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle className="text-base">Transaksi terbaru</CardTitle><p className="text-xs text-muted-foreground">Order selesai terbaru dari kasir dan QR Menu</p></CardHeader><CardContent className="space-y-0">{completed.slice(0, 10).map((o) => <div key={o.id} className="flex items-center justify-between gap-4 border-b py-3 last:border-0"><div className="min-w-0"><p className="font-medium">#{o.order_no}</p><p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("id-ID")} · {o.source === "qr" ? "QR Menu" : "Kasir"}</p></div><div className="text-right"><p className="num font-semibold">{rupiah(o.total)}</p><Badge variant={o.is_paid ? "secondary" : "outline"}>{o.is_paid ? "Lunas" : "Belum bayar"}</Badge></div></div>)}{completed.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Belum ada transaksi selesai.</p>}</CardContent></Card>
      </div>
    </AppShell>
  );
}
