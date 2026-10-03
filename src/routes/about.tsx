import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Coffee, Leaf } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type AboutPage = {
  title?: string;
  description?: string;
};

type AboutResponse = {
  data: {
    slug: string;
    title: string;
    content: AboutPage;
    status?: string;
  };
};

const POS_PUBLIC_API = "https://pos.yuripratama246.workers.dev/api/website/v1/pages/about";

async function fetchAboutPage(): Promise<AboutResponse["data"]> {
  const response = await fetch(POS_PUBLIC_API, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`About CMS request failed: ${response.status}`);
  }

  const payload = (await response.json()) as AboutResponse;
  return payload.data;
}

export const Route = createFileRoute("/about")({
  ssr: false,
  component: AboutPageRoute,
});

function AboutPageRoute() {
  const aboutQuery = useQuery({
    queryKey: ["cafe-flow-about-cms"],
    queryFn: fetchAboutPage,
  });

  const cmsContent = aboutQuery.data?.content;
  const title = cmsContent?.title ?? aboutQuery.data?.title ?? "About Cafe Flow";
  const description =
    cmsContent?.description ??
    "Kami percaya secangkir kopi sederhana bisa memberi ruang untuk ide baru, obrolan hangat, dan jeda yang berarti.";

  return (
    <div className="min-h-screen bg-white text-stone-900">
      <header className="sticky top-0 z-30 border-b border-stone-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Cafe Flow beranda">
            <span className="grid size-10 place-items-center rounded-full bg-emerald-950 text-white">
              <Coffee className="size-5" />
            </span>
            <span>
              <span className="block text-xl font-black tracking-tight">
                cafe flow<span className="text-emerald-700">.</span>
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-stone-500">
                Coffee • Made for your flow
              </span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 sm:px-5 sm:text-sm"
          >
            <ArrowLeft className="size-4" />
            Kembali
          </Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#f5f5ef]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 md:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-900">
                <Leaf className="size-4" />
                Tentang Cafe Flow
              </p>

              {aboutQuery.isLoading ? (
                <>
                  <div className="mx-auto h-12 w-2/3 animate-pulse rounded bg-stone-200 sm:h-16" />
                  <div className="mx-auto mt-7 h-24 w-full animate-pulse rounded bg-stone-200" />
                </>
              ) : aboutQuery.isError ? (
                <>
                  <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
                    {title}
                  </h1>
                  <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-stone-600">
                    {description}
                  </p>
                  <p className="mt-5 text-xs text-amber-700">
                    Konten CMS belum dapat dimuat. Menampilkan konten fallback.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-6xl">
                    {title}
                  </h1>
                  <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-stone-600">
                    {description}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-20">
          <div className="mx-auto max-w-3xl rounded-3xl border border-stone-100 bg-white p-7 shadow-sm sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
              Our story
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
              Coffee • Made for your flow
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              Cafe Flow hadir untuk menemani setiap alur harimu dengan kopi pilihan,
              suasana hangat, dan pengalaman yang sederhana namun berarti.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-white px-5 py-8 text-center text-xs text-stone-500">
        <p className="font-semibold text-stone-800">cafe flow.</p>
        <p className="mt-2">Coffee • Made for your flow</p>
        <p className="mt-4">© {new Date().getFullYear()} Cafe Flow. All rights reserved.</p>
      </footer>
    </div>
  );
}
