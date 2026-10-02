import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Coffee, Leaf, MapPin } from "lucide-react";
import { fetchMenuProducts, fetchCategories } from "@/lib/pos";
import { rupiah } from "@/lib/format";

export const Route = createFileRoute("/")({
  ssr: false,
  component: CafeFlowWebsite,
});

function CafeFlowWebsite() {
  const productsQuery = useQuery({ queryKey: ["cafe-flow-public-catalog"], queryFn: fetchMenuProducts });
  const categoriesQuery = useQuery({ queryKey: ["cafe-flow-public-categories"], queryFn: fetchCategories });
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name ?? "Pilihan Cafe Flow";

  return <div className="min-h-screen bg-white text-stone-900">
    <header className="sticky top-0 z-30 border-b border-stone-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Cafe Flow beranda">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-950 text-white"><Coffee className="size-5" /></span>
          <span><span className="block text-xl font-black tracking-tight">cafe flow<span className="text-emerald-700">.</span></span><span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-stone-500">Coffee • Made for your flow</span></span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex">
          <a href="#menu" className="transition hover:text-emerald-800">Menu</a>
          <a href="#story" className="transition hover:text-emerald-800">Cerita Kami</a>
        </nav>
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-emerald-950 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 sm:px-5 sm:text-sm">Masuk POS Kasir <ArrowRight className="size-4" /></Link>
      </div>
    </header>

    <main>
      <section className="relative isolate overflow-hidden bg-[#f5f5ef]">
        <div className="mx-auto grid min-h-[490px] max-w-7xl items-center gap-8 px-5 py-16 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:py-20">
          <div className="relative z-10 max-w-xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-900"><Leaf className="size-4" /> Seduh momenmu</p>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight text-stone-900 sm:text-6xl">Temukan jeda,<br/><span className="text-emerald-800">nikmati rasa.</span></h1>
            <p className="mt-6 max-w-md text-base leading-7 text-stone-600">Kopi pilihan dan teman cerita untuk menemani setiap alur harimu. Dibuat segar, disajikan dengan sepenuh hati.</p>
            <a href="#menu" className="mt-8 inline-flex items-center gap-3 rounded-full bg-emerald-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-800">Jelajahi Menu <ArrowRight className="size-4" /></a>
          </div>
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 rounded-[45%] bg-[#e6e8dc] blur-2xl" />
            <img src="https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1100&q=85" alt="Secangkir kopi Cafe Flow" className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-xl" />
            <div className="absolute -bottom-5 -left-3 rounded-2xl bg-white px-5 py-4 shadow-lg sm:left-[-2rem]"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Your daily ritual</p><p className="mt-1 font-display text-lg font-semibold">A little cup of joy.</p></div>
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-8 md:py-20">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Dari bar kami</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Menu favorit</h2><p className="mt-3 max-w-lg text-sm leading-6 text-stone-500">Pilihan kopi dan minuman yang tersedia hari ini. Harga dan foto mengikuti katalog Cafe Flow.</p></div>
          <span className="rounded-full border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600">{products.length} menu tersedia</span>
        </div>
        {productsQuery.isLoading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({length:8},(_,i)=><div key={i} className="animate-pulse"><div className="aspect-[4/3] rounded-2xl bg-stone-100"/><div className="mt-4 h-4 w-2/3 rounded bg-stone-100"/><div className="mt-2 h-4 w-1/3 rounded bg-stone-100"/></div>)}</div>
        : productsQuery.isError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Katalog belum dapat dimuat. Silakan coba refresh halaman beberapa saat lagi.</div>
        : products.length === 0 ? <div className="rounded-2xl border border-stone-200 p-8 text-center text-sm text-stone-500">Belum ada menu aktif yang ditampilkan.</div>
        : <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{products.map((product)=><article key={product.id} className="group min-w-0">
          <div className="relative overflow-hidden rounded-2xl bg-stone-100">
            {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.04]"/> : <div className="grid aspect-[4/3] place-items-center text-stone-400"><Coffee className="size-10"/></div>}
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-stone-700 shadow-sm">{categoryName(product.category_id)}</span>
          </div>
          <div className="flex items-start justify-between gap-3 pt-4"><div className="min-w-0"><h3 className="font-semibold leading-5">{product.name}</h3>{product.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{product.description}</p>}</div><p className="shrink-0 text-sm font-bold text-emerald-900">{rupiah(product.price)}</p></div>
        </article>)}</div>}
      </section>

      <section id="story" className="border-y border-stone-100 bg-[#fafaf7]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-2 md:items-center md:py-16">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">Tentang Cafe Flow</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Kopi yang mengikuti alur harimu.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">Kami percaya secangkir kopi sederhana bisa memberi ruang untuk ide baru, obrolan hangat, dan jeda yang berarti. Temukan favoritmu dan nikmati momen kecil hari ini.</p></div>
          <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-900"><MapPin className="size-5"/></span><div><p className="font-semibold">Singgah sebentar, isi energi.</p><p className="mt-1 text-sm text-stone-500">Kunjungi kami dan temukan racikan favoritmu.</p></div></div>
        </div>
      </section>
    </main>
    <footer className="bg-white px-5 py-8 text-center text-xs text-stone-500"><p className="font-semibold text-stone-800">cafe flow.</p><p className="mt-2">Coffee • Made for your flow</p><p className="mt-4">© {new Date().getFullYear()} Cafe Flow. All rights reserved.</p></footer>
  </div>;
}
