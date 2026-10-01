import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, ClipboardList, Coffee, Package, QrCode, ShoppingBag, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/demo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Demo Dashboard — Cafe Flow" }, { name: "description", content: "Jelajahi demo dashboard Cafe Flow tanpa login." }] }),
  component: DemoPage,
});

const stats = [
  { label: "Omzet Hari Ini", value: "Rp2.845.000", note: "+12,8% dari kemarin", icon: Wallet },
  { label: "Total Pesanan", value: "86", note: "72 sudah dibayar", icon: ClipboardList },
  { label: "Rata-rata Transaksi", value: "Rp39.514", note: "Per transaksi lunas", icon: BarChart3 },
  { label: "Menu Aktif", value: "24", note: "3 kategori menu", icon: Coffee },
];
const modules = [
  { title: "Kasir & POS", desc: "Simulasi alur transaksi dan pembayaran", icon: ShoppingBag },
  { title: "QR Ordering", desc: "Pemesanan pelanggan melalui QR meja", icon: QrCode },
  { title: "Produk & Stok", desc: "Kelola menu, harga, dan persediaan", icon: Package },
  { title: "Laporan Penjualan", desc: "Ringkasan omzet, tren, dan transaksi", icon: BarChart3 },
];
const bars = [34, 52, 43, 68, 48, 82, 61, 94, 70, 58, 76, 46];

function DemoPage() {
  return <main className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-300 text-neutral-950"><Coffee className="size-5"/></div><div><p className="font-semibold">Cafe Flow</p><p className="text-xs text-muted-foreground">Demo Dashboard</p></div></div>
        <div className="flex items-center gap-2"><span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 sm:inline-flex">Mode Demo · Data Contoh</span><Link to="/auth" className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">Masuk</Link></div>
      </div>
    </header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-amber-600">Selamat datang di Cafe Flow</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard Operasional</h1><p className="mt-2 text-sm text-muted-foreground">Lihat gambaran fitur POS dan pengelolaan cafe. Seluruh angka di halaman ini hanya data simulasi.</p></div><Link to="/auth" className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">Gunakan akun saya <ArrowLeft className="size-4 rotate-180"/></Link></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(s=><Card key={s.label}><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm text-muted-foreground">{s.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{s.value}</p><p className="mt-1 text-xs text-muted-foreground">{s.note}</p></div><div className="rounded-xl bg-primary/10 p-3 text-primary"><s.icon className="size-5"/></div></CardContent></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card><CardHeader><CardTitle className="text-base">Tren penjualan mingguan</CardTitle><p className="text-xs text-muted-foreground">Contoh omzet per hari · data simulasi</p></CardHeader><CardContent><div className="flex h-56 items-end gap-2 border-b pb-2">{bars.map((h,i)=><div key={i} className="flex h-full flex-1 flex-col justify-end gap-2"><div className="w-full rounded-t-md bg-amber-400/90" style={{height:h+"%"}}/><span className="text-center text-[10px] text-muted-foreground">{["S","S","R","K","J","S","M","S","S","R","K","J"][i]}</span></div>)}</div><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>Total contoh</span><strong className="text-foreground">Rp18.420.000</strong></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Aktivitas terbaru</CardTitle><p className="text-xs text-muted-foreground">Contoh aktivitas transaksi</p></CardHeader><CardContent className="space-y-4">{[{id:"CF-1024",item:"2x Cappuccino · Meja 04",time:"10:42",price:"Rp76.000"},{id:"CF-1023",item:"1x Es Kopi Susu · QR Order",time:"10:35",price:"Rp28.000"},{id:"CF-1022",item:"3x Americano · Takeaway",time:"10:21",price:"Rp90.000"}].map((o,i)=><div key={o.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-medium">{o.item}</p><p className="mt-1 text-xs text-muted-foreground">{o.id} · {o.time}</p></div><span className="text-sm font-semibold">{i===2?"Rp90.000":o.price}</span></div>)}</CardContent></Card>
      </div>
      <section><div className="mb-3"><h2 className="text-lg font-semibold">Jelajahi fitur Cafe Flow</h2><p className="text-sm text-muted-foreground">Preview fitur utama. Untuk mencoba transaksi dan menyimpan data, masuk menggunakan akun bisnis.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{modules.map(m=><Card key={m.title} className="transition hover:border-primary/40"><CardContent className="p-5"><div className="mb-3 grid size-10 place-items-center rounded-xl bg-muted"><m.icon className="size-5"/></div><h3 className="font-semibold">{m.title}</h3><p className="mt-1 text-sm text-muted-foreground">{m.desc}</p></CardContent></Card>)}</div></section>
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border bg-card p-5 sm:flex-row"><div><p className="font-semibold">Siap mencoba Cafe Flow untuk bisnis kamu?</p><p className="text-sm text-muted-foreground">Masuk untuk mengakses data outlet dan fitur operasional.</p></div><Link to="/auth" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Masuk ke Cafe Flow</Link></div>
      <p className="pb-4 text-center text-xs text-muted-foreground">Demo publik · Tidak terhubung ke data pelanggan atau transaksi nyata.</p>
    </div>
  </main>;
}
