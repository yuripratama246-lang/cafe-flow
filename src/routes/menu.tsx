import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingBag, Plus, Minus, Search, Clock3, Banknote, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchMenuProducts, fetchTables, fetchCategories, createOrder, type Product, type Order } from "@/lib/pos";
import { useQuery } from "@tanstack/react-query";
import { rupiah } from "@/lib/format";

export const Route = createFileRoute("/menu")({ component: PublicMenuPage });
type CartItem = Product & { quantity: number };
type PaymentChoice = "cash" | "qris";

function PublicMenuPage() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const tableCode = params.get("table") ?? "";
  const productsQuery = useQuery({ queryKey: ["public-menu"], queryFn: fetchMenuProducts });
  const tablesQuery = useQuery({ queryKey: ["public-tables"], queryFn: fetchTables });
  const categoriesQuery = useQuery({ queryKey: ["public-categories"], queryFn: fetchCategories });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Semua");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentChoice>("cash");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);

  const table = tablesQuery.data?.find((t) => t.code === tableCode);
  const products = productsQuery.data ?? [];
  const categoryMap = useMemo(() => new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name])), [categoriesQuery.data]);
  const categories = useMemo(() => ["Semua", ...Array.from(new Set(products.map((p) => p.category_id).filter(Boolean) as string[]))], [products]);
  const visible = products.filter((p) => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (category === "Semua" || p.category_id === category));
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function add(product: Product) {
    setCart((current) => {
      const found = current.find((i) => i.id === product.id);
      return found ? current.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i) : [...current, { ...product, quantity: 1 }];
    });
    toast.success(`${product.name} ditambahkan`, { duration: 900 });
  }
  function change(id: string, delta: number) { setCart((current) => current.flatMap((i) => i.id === id ? (i.quantity + delta > 0 ? [{ ...i, quantity: i.quantity + delta }] : []) : [i])); }

  async function submitOrder() {
    if (!table) return toast.error("QR meja tidak valid.");
    if (!cart.length) return toast.error("Tambahkan menu terlebih dahulu.");
    try {
      const created = await createOrder({
        source: "qr", status: "new", table_id: table.id,
        customer_name: customerName.trim() || null,
        notes: notes.trim() || null,
        subtotal: total, discount: 0, tax: 0, total, is_paid: false,
        payment_method: payment,
        payment_status: payment === "qris" ? "awaiting_confirmation" : "unpaid",
        items: cart.map((i) => ({ product_id: i.id, product_name: i.name, unit_price: Number(i.price), quantity: i.quantity })),
      });
      setCart([]); setCheckoutOpen(false); setPendingOrder(created);
      toast.success("Pesanan masuk dan menunggu kasir");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Pesanan gagal dikirim"); }
  }

  if (pendingOrder) return (
    <div className="min-h-screen bg-slate-50 p-5">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-50"><Clock3 className="size-9 text-amber-500" /></div>
        <h1 className="mt-5 text-2xl font-bold">Menunggu konfirmasi kasir</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Pesanan <b className="text-slate-700">#{pendingOrder.order_no}</b> sudah dikirim. Pesanan baru akan diproses setelah pembayaran dikonfirmasi kasir.</p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-left text-sm"><div className="flex justify-between"><span className="text-slate-500">Meja</span><b>{table?.name ?? "-"}</b></div><div className="mt-2 flex justify-between"><span className="text-slate-500">Pembayaran</span><b>{payment === "qris" ? "QRIS · menunggu konfirmasi" : "Bayar di kasir · belum dibayar"}</b></div><div className="mt-2 flex justify-between border-t pt-2"><span className="text-slate-500">Total</span><b>{rupiah(pendingOrder.total)}</b></div></div>
        <p className="mt-4 text-xs leading-5 text-slate-400">{payment === "cash" ? "Silakan lakukan pembayaran di kasir." : "Jika pembayaran QRIS sudah dilakukan, kasir akan memverifikasi pembayaran."}</p>
        <Button className="mt-6 w-full rounded-xl" onClick={() => setPendingOrder(null)}>Pesan lagi</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f7f7] pb-32 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-600">Cafe Flow</p><h1 className="truncate text-xl font-bold">Mau makan apa?</h1>{table && <p className="mt-0.5 text-xs text-slate-500">{table.name} · {table.code}</p>}</div><div className="relative grid size-11 shrink-0 place-items-center rounded-full bg-slate-100"><ShoppingBag className="size-5" />{itemCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-teal-600 text-[10px] font-bold text-white">{itemCount}</span>}</div></div><div className="relative mt-4"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><Input className="h-10 rounded-xl border-0 bg-slate-100 pl-9" placeholder="Cari menu, kopi, makanan..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1">{categories.map((c) => <button key={c} type="button" onClick={() => setCategory(c)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${category === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{c === "Semua" ? c : categoryMap.get(c) ?? "Kategori"}</button>)}</div></div></header>
      <main className="mx-auto max-w-3xl p-4"><div className="mb-4"><h2 className="text-lg font-bold">Menu</h2><p className="text-xs text-slate-500">Pilih makanan & minuman favorit kamu</p></div><div className="grid gap-3 sm:grid-cols-2">{visible.map((p) => <article key={p.id} className="flex gap-3 rounded-2xl bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"><div className="size-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">{p.image_url ? <img src={p.image_url} alt={p.name} className="size-full object-cover" loading="lazy" /> : <div className="grid size-full place-items-center text-xs text-slate-400">No photo</div>}</div><div className="min-w-0 flex-1"><h2 className="font-semibold leading-5">{p.name}</h2><p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">{p.description || "Menu pilihan Cafe Flow"}</p><div className="mt-3 flex items-center justify-between gap-2"><strong className="text-sm">{rupiah(p.price)}</strong><Button size="sm" className="rounded-xl" onClick={() => add(p)}><Plus className="mr-1 size-4" />Tambah</Button></div></div></article>)}</div></main>
      {cart.length > 0 && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/98 p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">{itemCount} item · Total</p><p className="text-xl font-bold">{rupiah(total)}</p></div><Button size="lg" className="rounded-xl px-6" onClick={() => setCheckoutOpen(true)}>Lihat pesanan</Button></div></div></div>}
      {checkoutOpen && <div className="fixed inset-0 z-50 bg-black/40 p-4" onClick={() => setCheckoutOpen(false)}><div className="mx-auto mt-auto max-w-lg rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Checkout</h2><p className="text-xs text-slate-500">Pesanan akan menunggu persetujuan kasir</p></div><button type="button" className="text-sm text-slate-400" onClick={() => setCheckoutOpen(false)}>Tutup</button></div><div className="mt-4 max-h-60 space-y-2 overflow-y-auto">{cart.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2"><div className="size-16 shrink-0 overflow-hidden rounded-lg bg-slate-200">{item.image_url ? <img src={item.image_url} alt={item.name} className="size-full object-cover" loading="lazy" /> : null}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-slate-500">{rupiah(item.price)} × {item.quantity}</p></div><Button size="icon" variant="outline" className="size-7 rounded-lg" onClick={() => change(item.id, -1)}><Minus className="size-3" /></Button><span className="w-4 text-center text-sm font-semibold">{item.quantity}</span><Button size="icon" variant="outline" className="size-7 rounded-lg" onClick={() => change(item.id, 1)}><Plus className="size-3" /></Button></div>)}</div><div className="mt-4 grid gap-2 sm:grid-cols-2"><Input placeholder="Nama pelanggan (opsional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><Textarea placeholder="Catatan pesanan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} /></div><div className="mt-4"><p className="mb-2 text-sm font-bold">Pilih pembayaran</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPayment("cash")} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${payment === "cash" ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" : "border-slate-200"}`}><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><Banknote className="size-5" /></span><span><b className="block text-sm">Bayar di kasir</b><small className="text-xs text-slate-500">Bayar saat dikonfirmasi</small></span></button><button type="button" onClick={() => setPayment("qris")} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${payment === "qris" ? "border-teal-600 bg-teal-50 ring-1 ring-teal-600" : "border-slate-200"}`}><span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-sky-600"><QrCode className="size-5" /></span><span><b className="block text-sm">QRIS</b><small className="text-xs text-slate-500">Menunggu verifikasi kasir</small></span></button></div></div><div className="mt-5 flex items-center justify-between border-t pt-4"><div><p className="text-xs text-slate-500">Total pembayaran</p><p className="text-xl font-bold">{rupiah(total)}</p></div><Button size="lg" className="rounded-xl px-6" onClick={submitOrder}>Kirim pesanan</Button></div></div></div>}
    </div>
  );
}
