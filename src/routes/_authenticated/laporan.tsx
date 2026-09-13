import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, CreditCard, RefreshCw, ShoppingCart, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchOrders, PAYMENT_LABEL } from "@/lib/pos";
import { endOfDayISO, rupiah, startOfDayISO, timeLabel, toDateInput } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/laporan")({ component: ReportsPage });

type Point = { label: string; value: number };

function ReportsPage() {
  // Keep the report scope identical to Dashboard: selected local day, exclude
  // cancelled orders, and use paid orders for financial metrics.
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const query = useQuery({
    queryKey: ["orders", "report", selectedDate],
    queryFn: () => fetchOrders({ from: startOfDayISO(selectedDate), to: endOfDayISO(selectedDate), limit: 200 }),
    refetchInterval: 30000,
  });

  const orders = useMemo(
    () => (query.data ?? []).filter((o) => o.status !== "cancelled"),
    [query.data],
  );
  const paidOrders = orders.filter((o) => o.is_paid);
  const penjualan = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const items = orders.reduce((sum, o) => sum + o.order_items.reduce((n, i) => n + i.quantity, 0), 0);
  const average = paidOrders.length ? penjualan / paidOrders.length : 0;

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach((o) => o.order_items.forEach((item) => {
      const current = map.get(item.product_name) ?? { name: item.product_name, qty: 0, revenue: 0 };
      current.qty += item.quantity;
      current.revenue += Number(item.line_total || 0);
      map.set(item.product_name, current);
    }));
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  const payments = useMemo(() => {
    const map = new Map<string, number>();
    paidOrders.forEach((o) => o.payments?.forEach((p) => {
      map.set(p.method, (map.get(p.method) ?? 0) + Number(p.amount || 0));
    }));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [paidOrders]);

  const paymentTotal = payments.reduce((sum, [, value]) => sum + value, 0) || 1;
  const maxProduct = Math.max(...topProducts.map((p) => p.qty), 1);

  const dailySales = useMemo<Point[]>(() => {
    if (!orders.length) return [];
    return [{ label: selectedDate.slice(8, 10) + "/" + selectedDate.slice(5, 7), value: penjualan }];
  }, [orders.length, penjualan, selectedDate]);

  return (
    <AppShell
      title="Laporan Penjualan"
      description="Pantau performa penjualan dan pola transaksi Cafe Flow"
      actions={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="hidden text-muted-foreground sm:inline">Tanggal</span>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent font-medium outline-none" />
          </label>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCw className="mr-2 size-4" />Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Penjualan", rupiah(penjualan), Wallet],
            ["Transaksi", String(orders.length), ShoppingCart],
            ["Item terjual", String(items), BarChart3],
            ["Rata-rata transaksi", rupiah(average), CreditCard],
          ].map(([label, value, Icon]) => {
            const IconComponent = Icon as typeof Wallet;
            return (
              <Card key={String(label)}>
                <CardContent className="flex items-start justify-between p-5">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="num mt-1 text-2xl font-semibold tracking-tight">{value}</p>
                  </div>
                  <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <IconComponent className="size-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Penjualan hari ini</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Sama dengan angka Penjualan di Dashboard</p>
              </div>
              <Badge variant="secondary">{rupiah(penjualan)} lunas</Badge>
            </CardHeader>
            <CardContent>
              {query.isLoading ? (
                <div className="h-48 animate-pulse rounded-lg bg-muted" />
              ) : dailySales.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Belum ada penjualan pada tanggal ini.</p>
              ) : (
                <div className="flex h-48 items-end gap-3 border-b border-border px-2">
                  {dailySales.map((point) => (
                    <div key={point.label} className="flex h-full flex-1 flex-col justify-end">
                      <div className="w-full rounded-t-lg bg-primary/75" style={{ height: point.value ? "100%" : "4%" }} title={rupiah(point.value)} />
                      <span className="py-2 text-center text-xs text-muted-foreground">{point.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metode pembayaran</CardTitle>
              <p className="text-xs text-muted-foreground">Hanya transaksi yang sudah lunas</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {payments.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Belum ada pembayaran.</p>
              ) : payments.map(([method, amount]) => {
                const pct = Math.round((amount / paymentTotal) * 100);
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{PAYMENT_LABEL[method] ?? method}</span>
                      <span className="num font-medium">{pct}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="num mt-1 text-[11px] text-muted-foreground">{rupiah(amount)}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produk terlaris</CardTitle>
              <p className="text-xs text-muted-foreground">Berdasarkan item pada tanggal terpilih</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {topProducts.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Belum ada produk terjual.</p>
              ) : topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <span className="truncate text-sm font-medium">{product.name}</span>
                      <span className="num text-xs font-semibold">{product.qty} item</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/75" style={{ width: `${Math.max((product.qty / maxProduct) * 100, 5)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ringkasan kas</CardTitle>
              <p className="text-xs text-muted-foreground">Mengikuti standar Dashboard</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-sm text-muted-foreground">Penjualan bersih</span>
                <span className="num font-semibold">{rupiah(penjualan)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-sm text-muted-foreground">Sudah dibayar</span>
                <span className="num font-semibold">{rupiah(penjualan)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Belum dibayar</span>
                <span className="num font-semibold">{rupiah(Math.max(orders.reduce((sum, o) => sum + Number(o.total || 0), 0) - penjualan, 0))}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaksi terbaru</CardTitle>
            <p className="text-xs text-muted-foreground">Order pada tanggal terpilih</p>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
            ) : (
              <div className="divide-y divide-border">
                {orders.slice(0, 10).map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-4 py-3 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium">#{o.order_no}</p>
                      <p className="text-xs text-muted-foreground">{timeLabel(o.created_at)} · {o.source === "qr" ? "QR Menu" : "Kasir"}</p>
                    </div>
                    <div className="text-right">
                      <p className="num font-semibold">{rupiah(o.total)}</p>
                      <Badge variant={o.is_paid ? "secondary" : "outline"}>{o.is_paid ? "Lunas" : "Belum bayar"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
