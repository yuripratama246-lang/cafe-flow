import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Plus, Minus, Trash2, ShoppingCart, Coffee } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Receipt } from "@/components/Receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rupiah } from "@/lib/format";
import {
  TAX_RATE,
  createOrder,
  fetchCategories,
  fetchProducts,
  fetchTables,
  type OrderWithItems,
  type Product,
} from "@/lib/pos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kasir")({
  head: () => ({
    meta: [
      { title: "Kasir — Kasirku POS" },
      { name: "description", content: "Layar kasir cepat: pilih menu, hitung diskon dan pajak, terima pembayaran tunai, kartu, atau QRIS." },
      { property: "og:title", content: "Kasir — Kasirku POS" },
      { property: "og:description", content: "Layar kasir cepat dengan pembayaran tunai, kartu, dan QRIS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KasirPage,
});

type CartLine = { product: Product; quantity: number };
type PaymentMethod = "cash" | "card" | "qris";

function KasirPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const tablesQuery = useQuery({ queryKey: ["tables"], queryFn: fetchTables });

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [tableId, setTableId] = useState<string>("none");
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [receipt, setReceipt] = useState<OrderWithItems | null>(null);

  const products = productsQuery.data ?? [];
  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          p.is_active &&
          (activeCategory === "all" || p.category_id === activeCategory) &&
          p.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [products, activeCategory, search],
  );

  const subtotal = cart.reduce((s, l) => s + Number(l.product.price) * l.quantity, 0);
  const discountRaw = Number(discountValue) || 0;
  const discount = Math.min(
    discountType === "percent" ? (subtotal * discountRaw) / 100 : discountRaw,
    subtotal,
  );
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * TAX_RATE);
  const total = Math.max(Math.round(taxable + tax), 0);
  const change = Math.max((Number(cashReceived) || 0) - total, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.warning(`Stok ${product.name} tinggal ${product.stock}`);
          return prev;
        }
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      if (product.stock < 1) {
        toast.warning(`${product.name} habis`);
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function resetSale() {
    setCart([]);
    setDiscountValue("");
    setCashReceived("");
    setTableId("none");
    setMethod("cash");
  }

  const checkout = useMutation({
    mutationFn: async () =>
      createOrder({
        source: "pos",
        status: "completed",
        table_id: tableId === "none" ? null : tableId,
        subtotal,
        discount,
        tax,
        total,
        is_paid: true,
        items: cart.map((l) => ({
          product_id: l.product.id,
          product_name: l.product.name,
          unit_price: Number(l.product.price),
          quantity: l.quantity,
        })),
        payment: {
          method,
          amount: total,
          cash_received: method === "cash" ? Number(cashReceived) || total : null,
          change_amount: method === "cash" ? change : null,
        },
      }),
    onSuccess: (order) => {
      setPayOpen(false);
      setReceipt(order);
      resetSale();
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Pembayaran #${order.order_no} berhasil`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan transaksi"),
  });

  return (
    <AppShell title="Kasir" description="Pilih menu, atur diskon, lalu terima pembayaran">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu…"
              className="h-11 pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <CategoryChip
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
              label="Semua"
            />
            {(categoriesQuery.data ?? []).map((c) => (
              <CategoryChip
                key={c.id}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
                label={c.name}
              />
            ))}
          </div>

          {productsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-2xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Menu tidak ditemukan.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {visible.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  disabled={p.stock < 1}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md disabled:opacity-50"
                >
                  <div className="grid h-20 place-items-center bg-muted">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <Coffee className="size-7 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                    <p className="num mt-auto text-sm font-semibold text-primary">
                      {rupiah(p.price)}
                    </p>
                    <Badge
                      variant={p.stock <= p.low_stock_threshold ? "destructive" : "secondary"}
                      className="w-fit text-[10px]"
                    >
                      stok {p.stock}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <Card className="h-fit xl:sticky xl:top-24">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-4.5 text-primary" />
              <h2 className="text-base font-semibold">Keranjang</h2>
              <Badge variant="secondary" className="ml-auto">
                {cart.reduce((s, l) => s + l.quantity, 0)} item
              </Badge>
            </div>

            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ketuk menu untuk menambah pesanan.
              </p>
            ) : (
              <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {cart.map((l) => (
                  <li key={l.product.id} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.product.name}</p>
                      <p className="num text-xs text-muted-foreground">
                        {rupiah(l.product.price)} × {l.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="size-7" onClick={() => changeQty(l.product.id, -1)}>
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="num w-6 text-center text-sm">{l.quantity}</span>
                      <Button size="icon" variant="outline" className="size-7" onClick={() => changeQty(l.product.id, 1)}>
                        <Plus className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive"
                        onClick={() => setCart((prev) => prev.filter((x) => x.product.id !== l.product.id))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Meja (opsional)</Label>
                <Select value={tableId} onValueChange={setTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih meja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa meja</SelectItem>
                    {(tablesQuery.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Diskon</Label>
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="num"
                  />
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as "amount" | "percent")}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Rp</SelectItem>
                      <SelectItem value="percent">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <dl className="space-y-1.5 text-sm">
              <SummaryRow label="Subtotal" value={rupiah(subtotal)} />
              <SummaryRow label="Diskon" value={`- ${rupiah(discount)}`} />
              <SummaryRow label={`Pajak (${Math.round(TAX_RATE * 100)}%)`} value={rupiah(tax)} />
              <div className="flex justify-between pt-2 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="num text-primary">{rupiah(total)}</dd>
              </div>
            </dl>

            <Button
              className="h-12 w-full text-base"
              disabled={cart.length === 0}
              onClick={() => setPayOpen(true)}
            >
              Bayar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">Total tagihan</p>
              <p className="num text-3xl font-semibold text-primary">{rupiah(total)}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["cash", "card", "qris"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-xl border border-border px-3 py-3 text-sm font-medium transition-colors",
                    method === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {m === "cash" ? "Tunai" : m === "card" ? "Kartu" : "QRIS"}
                </button>
              ))}
            </div>

            {method === "cash" ? (
              <div className="space-y-2">
                <Label htmlFor="cash">Uang diterima</Label>
                <Input
                  id="cash"
                  inputMode="numeric"
                  className="num h-12 text-lg"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0"
                />
                <div className="flex flex-wrap gap-2">
                  {[total, 50000, 100000, 150000].map((v, i) => (
                    <Button
                      key={`${v}-${i}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setCashReceived(String(v))}
                      className="num"
                    >
                      {rupiah(v)}
                    </Button>
                  ))}
                </div>
                <div className="flex justify-between rounded-xl bg-success/10 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Kembalian</span>
                  <span className="num font-semibold text-success">{rupiah(change)}</span>
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                {method === "qris"
                  ? "Minta pelanggan memindai QRIS outlet, lalu konfirmasi setelah pembayaran masuk."
                  : "Gesek atau tap kartu pada mesin EDC, lalu konfirmasi."}
              </p>
            )}

            <Button
              className="h-12 w-full text-base"
              disabled={
                checkout.isPending || (method === "cash" && (Number(cashReceived) || 0) < total)
              }
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? "Menyimpan…" : "Konfirmasi pembayaran"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={receipt !== null} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Struk digital</DialogTitle>
          </DialogHeader>
          {receipt ? <Receipt order={receipt} /> : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function CategoryChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
