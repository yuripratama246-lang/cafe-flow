import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Wallet,
  Receipt as ReceiptIcon,
  ShoppingBasket,
  AlertTriangle,
  ScanLine,
  ClipboardList,
  Package,
  QrCode,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Smartphone,
  CalendarDays,
  ChevronRight,
  TrendingUp,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrders, fetchProducts, PAYMENT_LABEL, STATUS_LABEL } from "@/lib/pos";
import { rupiah, timeLabel, startOfDayISO, endOfDayISO, toDateInput } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Cafe Flow" },
      { name: "description", content: "Dashboard penjualan, transaksi, produk terlaris, pembayaran, dan stok Cafe Flow." },
    ],
  }),
  component: DashboardPage,
});

const QUICK_ACTIONS = [
  { to: "/kasir", label: "Buka Kasir", note: "Mulai transaksi", icon: ScanLine },
  { to: "/pesanan", label: "Kelola Pesanan", note: "Antrean & status", icon: ClipboardList },
  { to: "/produk", label: "Produk & Stok", note: "Menu, harga & stok", icon: Package },
  { to: "/meja", label: "Meja & QR", note: "Atur meja & QR menu", icon: QrCode },
] as const;

const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  qris: Smartphone,
};

function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(toDateInput(new Date()));
  const ordersQuery = useQuery({
    queryKey: ["orders", "dashboard", selectedDate],
    queryFn: () => fetchOrders({ from: startOfDayISO(selectedDate), to: endOfDayISO(selectedDate), limit: 200 }),
  });
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const orders = useMemo(
    () => (ordersQuery.data ?? []).filter((o) => o.status !== "cancelled"),
    [ordersQuery.data],
  );
  const paidOrders = orders.filter((o) => o.is_paid);
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const itemsSold = orders.reduce((sum, o) => sum + o.order_items.reduce((s, i) => s + i.quantity, 0), 0);
  const averageTicket = paidOrders.length ? revenue / paidOrders.length : 0;
  const lowStock = (productsQuery.data ?? []).filter((p) => p.is_active && p.stock <= p.low_stock_threshold);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach((order) => order.order_items.forEach((item) => {
      const current = map.get(item.product_name) ?? { name: item.product_name, qty: 0, revenue: 0 };
      current.qty += item.quantity;
      current.revenue += Number(item.line_total);
      map.set(item.product_name, current);
    }));
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  const hourlySales = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => i + 9);
    return hours.map((hour) => {
      const value = paidOrders
        .filter((o) => new Date(o.created_at).getHours() === hour)
        .reduce((sum, o) => sum + Number(o.total), 0);
      return { hour, value };
    });
  }, [paidOrders]);
  const maxHourly = Math.max(...hourlySales.map((x) => x.value), 1);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    paidOrders.forEach((order) => order.payments?.forEach((payment) => {
      map.set(payment.method, (map.get(payment.method) ?? 0) + Number(payment.amount));
    }));
    if (!map.size) map.set("unpaid", 0);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [paidOrders]);

  const stats = [
    { label: "Penjualan bersih", value: rupiah(revenue), helper: "Total transaksi dibayar", icon: Wallet },
    { label: "Transaksi", value: String(orders.length), helper: `${paidOrders.length} sudah dibayar`, icon: ReceiptIcon },
    { label: "Rata-rata transaksi", value: rupiah(averageTicket), helper: "Nilai per transaksi", icon: TrendingUp },
    { label: "Item terjual", value: String(itemsSold), helper: `${lowStock.length} produk stok menipis`, icon: ShoppingBasket },
  ];

  return (
    <AppShell
      title="Dashboard"
      description="Pantau performa outlet secara real-time"
      actions={
        <label className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs md:flex">
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">Tanggal</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent font-medium outline-none"
          />
        </label>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="overflow-hidden">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {ordersQuery.isLoading ? <Skeleton className="mt-2 h-7 w-28" /> : <p className="num mt-1 truncate text-2xl font-semibold tracking-tight">{stat.value}</p>}
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{stat.helper}</p>
                </div>
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <stat.icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <action.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{action.label}</p>
                <p className="truncate text-xs text-muted-foreground">{action.note}</p>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Grafik penjualan</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Omzet per jam pada tanggal terpilih</p>
              </div>
              <Badge variant="secondary">{rupiah(revenue)}</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-2 border-b border-border px-1 pt-5">
                {hourlySales.map((item) => (
                  <div key={item.hour} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
                    <div className="relative flex h-full items-end">
                      <div
                        className="w-full rounded-t-md bg-primary/75 transition group-hover:bg-primary"
                        style={{ height: `${Math.max((item.value / maxHourly) * 100, item.value ? 8 : 2)}%` }}
                        title={`${item.hour}:00 · ${rupiah(item.value)}`}
                      />
                    </div>
                    <span className="text-center text-[10px] text-muted-foreground">{item.hour}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metode pembayaran</CardTitle>
              <p className="text-xs text-muted-foreground">Distribusi transaksi yang sudah dibayar</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentBreakdown.map(([method, amount]) => {
                const Icon = PAYMENT_ICONS[method] ?? CreditCard;
                const percent = revenue ? Math.round((amount / revenue) * 100) : 0;
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        <span>{PAYMENT_LABEL[method] ?? method}</span>
                      </div>
                      <span className="num font-medium">{rupiah(amount)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Menu terlaris</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Berdasarkan jumlah item terjual</p>
              </div>
              <Link to="/produk" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Kelola produk <ChevronRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              {ordersQuery.isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : topProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Belum ada penjualan pada tanggal ini.</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((product, index) => (
                    <div key={product.name} className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max((product.qty / (topProducts[0]?.qty || 1)) * 100, 5)}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="num text-sm font-semibold">{product.qty} item</p>
                        <p className="num text-[11px] text-muted-foreground">{rupiah(product.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Stok menipis</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Perlu diperhatikan</p>
              </div>
              <Package className="size-5 text-warning" />
            </CardHeader>
            <CardContent>
              {productsQuery.isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : lowStock.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Semua stok aman.</p>
              ) : (
                <div className="space-y-3">
                  {lowStock.slice(0, 6).map((product) => (
                    <div key={product.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground">Batas minimum {product.low_stock_threshold}</p>
                      </div>
                      <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>{product.stock} tersisa</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Transaksi terbaru</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Aktivitas kasir & QR Menu</p>
              </div>
              <Link to="/pesanan" className="text-xs font-medium text-primary hover:underline">Lihat semua</Link>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
              ) : (
                <div className="divide-y divide-border">
                  {orders.slice(0, 6).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">#{order.order_no} · {order.order_items.length} item</p>
                        <p className="text-[11px] text-muted-foreground">{timeLabel(order.created_at)} · {order.source === "qr" ? "QR Menu" : "Kasir"} · {STATUS_LABEL[order.status]}</p>
                      </div>
                      <div className="text-right">
                        <p className="num text-sm font-semibold">{rupiah(order.total)}</p>
                        <span className="text-[10px] text-muted-foreground">{order.is_paid ? "Lunas" : "Belum bayar"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operasional cepat</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Shortcut yang paling sering dipakai</p>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              <Link to="/kasir" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50">
                <ScanLine className="size-5 text-primary" /><span className="text-sm font-medium">Transaksi baru</span>
              </Link>
              <Link to="/pesanan" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50">
                <ClipboardList className="size-5 text-primary" /><span className="text-sm font-medium">Antrean pesanan</span>
              </Link>
              <Link to="/meja" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50">
                <QrCode className="size-5 text-primary" /><span className="text-sm font-medium">QR & meja</span>
              </Link>
              <Link to="/laporan" className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50">
                <Users className="size-5 text-primary" /><span className="text-sm font-medium">Laporan outlet</span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
