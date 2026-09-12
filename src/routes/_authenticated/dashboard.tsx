import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Receipt as ReceiptIcon,
  ShoppingBasket,
  AlertTriangle,
  ScanLine,
  ClipboardList,
  Package,
  QrCode,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrders, fetchProducts, STATUS_LABEL } from "@/lib/pos";
import { rupiah, timeLabel, startOfDayISO, endOfDayISO, toDateInput } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Penjualan — Kasirku POS" },
      { name: "description", content: "Ringkasan omzet harian, jumlah transaksi, item terjual, dan stok menipis untuk kafe Anda." },
      { property: "og:title", content: "Dashboard Penjualan — Kasirku POS" },
      { property: "og:description", content: "Ringkasan omzet harian, transaksi, dan stok menipis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const SHORTCUTS = [
  { to: "/kasir", label: "Buka Kasir", note: "Transaksi cepat", icon: ScanLine },
  { to: "/pesanan", label: "Antrean Pesanan", note: "Pantau status", icon: ClipboardList },
  { to: "/produk", label: "Produk & Stok", note: "Kelola menu", icon: Package },
  { to: "/meja", label: "QR Meja", note: "Cetak kode QR", icon: QrCode },
] as const;

function DashboardPage() {
  const today = toDateInput(new Date());
  const ordersQuery = useQuery({
    queryKey: ["orders", "today", today],
    queryFn: () => fetchOrders({ from: startOfDayISO(today), to: endOfDayISO(today) }),
  });
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const orders = (ordersQuery.data ?? []).filter((o) => o.status !== "cancelled");
  const revenue = orders.filter((o) => o.is_paid).reduce((sum, o) => sum + Number(o.total), 0);
  const itemsSold = orders.reduce(
    (sum, o) => sum + o.order_items.reduce((s, i) => s + i.quantity, 0),
    0,
  );
  const lowStock = (productsQuery.data ?? []).filter((p) => p.is_active && p.stock <= p.low_stock_threshold);

  const stats = [
    { label: "Omzet hari ini", value: rupiah(revenue), icon: Wallet, tone: "text-primary" },
    { label: "Transaksi", value: String(orders.length), icon: ReceiptIcon, tone: "text-chart-4" },
    { label: "Item terjual", value: String(itemsSold), icon: ShoppingBasket, tone: "text-success" },
    { label: "Stok menipis", value: String(lowStock.length), icon: AlertTriangle, tone: "text-warning" },
  ];

  return (
    <AppShell title="Dashboard" description="Ringkasan performa outlet hari ini">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                  <s.icon className={`size-5 ${s.tone}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  {ordersQuery.isLoading ? (
                    <Skeleton className="mt-1 h-6 w-24" />
                  ) : (
                    <p className="num truncate text-xl font-semibold">{s.value}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <s.icon className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.note}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Penjualan terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersQuery.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Belum ada transaksi hari ini.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {orders.slice(0, 8).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          #{o.order_no} · {o.order_items.length} item
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {timeLabel(o.created_at)} · {o.source === "qr" ? "QR Menu" : "Kasir"} ·{" "}
                          {STATUS_LABEL[o.status]}
                        </p>
                      </div>
                      <span className="num text-sm font-semibold">{rupiah(o.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stok menipis</CardTitle>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Semua stok aman.</p>
              ) : (
                <ul className="space-y-3">
                  {lowStock.slice(0, 8).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm">{p.name}</span>
                      <Badge variant={p.stock === 0 ? "destructive" : "secondary"}>
                        {p.stock} tersisa
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
