import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Eye, Save, Globe, Image,
  Type, MousePointer2, MessageCircle, LayoutTemplate, BriefcaseBusiness,
  MapPin, Phone, GalleryHorizontal, Video, Columns3, HelpCircle, ShoppingBag,
  Pencil, Info, ExternalLink, Settings2
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

const PUBLIC_WEBSITE_URL = "https://cafeflow.alpana1project.workers.dev";

type BlockType =
  | "hero" | "text" | "image" | "button" | "whatsapp" | "gallery" | "video"
  | "cards" | "menu" | "contact" | "location" | "faq" | "careers" | "divider" | "spacer";

type Block = { id: string; type: BlockType; props: Record<string, any> };
type Page = {
  id: string;
  slug: string;
  title: string;
  content: any;
  status: "draft" | "published";
  seo_meta: any;
  sort_order: number;
  show_in_navigation: boolean;
  navigation_label: string | null;
  is_home: boolean;
  template: string;
};

const defaults: Record<BlockType, Record<string, any>> = {
  hero: { eyebrow: "", title: "Judul utama", description: "Tulis pesan utama website di sini.", image: "", primaryLabel: "Lihat Selengkapnya", primaryUrl: "#", secondaryLabel: "", secondaryUrl: "", align: "left" },
  text: { eyebrow: "", title: "Judul section", body: "Tulis isi section di sini.", align: "left" },
  image: { src: "", alt: "", caption: "" },
  button: { label: "Tombol", url: "#", style: "primary", newTab: false },
  whatsapp: { label: "Chat WhatsApp", number: "", message: "Halo, saya ingin bertanya." },
  gallery: { title: "Gallery", items: [{ image: "", title: "", caption: "" }, { image: "", title: "", caption: "" }], columns: 3 },
  video: { title: "Video", url: "", poster: "", caption: "" },
  cards: { title: "Pilihan Kami", items: [{ title: "Card 1", description: "Deskripsi", image: "", url: "#" }, { title: "Card 2", description: "Deskripsi", image: "", url: "#" }], columns: 2 },
  menu: { title: "Menu", subtitle: "Pilihan favorit kami.", limit: 8, showPrice: true, showImage: true },
  contact: { title: "Hubungi Kami", description: "Kami siap membantu.", showWhatsapp: true, showEmail: true, showPhone: true },
  location: { title: "Lokasi Kami", address: "", phone: "", mapUrl: "", hours: "" },
  faq: { title: "FAQ", items: [{ question: "Pertanyaan?", answer: "Jawaban." }, { question: "Pertanyaan lain?", answer: "Jawaban lain." }] },
  careers: { title: "Karier", description: "Bergabung bersama kami.", limit: 6 },
  divider: { style: "line" },
  spacer: { height: 48 },
};

const blockMeta: { type: BlockType; label: string; help: string; icon: any; group: string }[] = [
  { type: "hero", label: "Hero / Banner", help: "Bagian utama paling atas", icon: LayoutTemplate, group: "Konten" },
  { type: "text", label: "Teks", help: "Judul dan paragraf", icon: Type, group: "Konten" },
  { type: "image", label: "Gambar", help: "Satu gambar besar", icon: Image, group: "Konten" },
  { type: "button", label: "Tombol", help: "Tombol ke halaman/link", icon: MousePointer2, group: "Konten" },
  { type: "gallery", label: "Galeri Foto", help: "Beberapa foto sekaligus", icon: GalleryHorizontal, group: "Media" },
  { type: "video", label: "Video", help: "YouTube/Vimeo/embed", icon: Video, group: "Media" },
  { type: "cards", label: "Kartu", help: "Produk, layanan, keunggulan", icon: Columns3, group: "Tampilan" },
  { type: "divider", label: "Garis Pemisah", help: "Memisahkan antar bagian", icon: Columns3, group: "Tampilan" },
  { type: "spacer", label: "Jarak", help: "Memberi ruang kosong", icon: Columns3, group: "Tampilan" },
  { type: "whatsapp", label: "WhatsApp", help: "Tombol chat WhatsApp", icon: MessageCircle, group: "Bisnis" },
  { type: "menu", label: "Menu Produk", help: "Ambil produk dari POS", icon: ShoppingBag, group: "Bisnis" },
  { type: "contact", label: "Kontak", help: "Info kontak perusahaan", icon: Phone, group: "Bisnis" },
  { type: "location", label: "Lokasi", help: "Alamat, jam buka, Maps", icon: MapPin, group: "Bisnis" },
  { type: "faq", label: "FAQ", help: "Pertanyaan yang sering ditanya", icon: HelpCircle, group: "Bisnis" },
  { type: "careers", label: "Karier", help: "Daftar lowongan kerja", icon: BriefcaseBusiness, group: "Bisnis" },
];

function makeBlock(type: BlockType): Block {
  return { id: crypto.randomUUID(), type, props: JSON.parse(JSON.stringify(defaults[type])) };
}

function blocksOf(page: Page): Block[] {
  const sections = page.content?.sections;
  return Array.isArray(sections) ? sections : [];
}

function Field({ label, children, help }: { label: string; children: any; help?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {help && <p className="text-[11px] leading-4 text-muted-foreground">{help}</p>}
    </div>
  );
}

function TextField({
  label, value, onChange, multi = false, placeholder, help
}: {
  label: string; value: any; onChange: (v: string) => void; multi?: boolean; placeholder?: string; help?: string;
}) {
  return (
    <Field label={label} help={help}>
      {multi ? (
        <Textarea value={value ?? ""} placeholder={placeholder} rows={4} onChange={e => onChange(e.target.value)} />
      ) : (
        <Input value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      )}
    </Field>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: any }) {
  return (
    <Field label={label}>
      <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
    </Field>
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const p = block.props;
  const set = (key: string, value: any) => onChange({ ...block, props: { ...p, [key]: value } });

  if (block.type === "hero") return <div className="space-y-4">
    <TextField label="Teks kecil di atas judul" value={p.eyebrow} onChange={v => set("eyebrow", v)} placeholder="Contoh: Cafe Flow" />
    <TextField label="Judul utama" value={p.title} onChange={v => set("title", v)} />
    <TextField label="Deskripsi" value={p.description} onChange={v => set("description", v)} multi />
    <TextField label="Gambar (opsional)" value={p.image} onChange={v => set("image", v)} placeholder="Tempel link gambar" />
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Teks tombol utama" value={p.primaryLabel} onChange={v => set("primaryLabel", v)} />
      <TextField label="Link tombol utama" value={p.primaryUrl} onChange={v => set("primaryUrl", v)} placeholder="Contoh: /contact atau https://..." />
      <TextField label="Teks tombol kedua" value={p.secondaryLabel} onChange={v => set("secondaryLabel", v)} />
      <TextField label="Link tombol kedua" value={p.secondaryUrl} onChange={v => set("secondaryUrl", v)} />
    </div>
    <SelectField label="Posisi teks" value={p.align} onChange={v => set("align", v)}>
      <option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option>
    </SelectField>
  </div>;

  if (block.type === "text") return <div className="space-y-4">
    <TextField label="Teks kecil (opsional)" value={p.eyebrow} onChange={v => set("eyebrow", v)} />
    <TextField label="Judul" value={p.title} onChange={v => set("title", v)} />
    <TextField label="Isi" value={p.body} onChange={v => set("body", v)} multi />
    <SelectField label="Posisi teks" value={p.align} onChange={v => set("align", v)}>
      <option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option>
    </SelectField>
  </div>;

  if (block.type === "image") return <div className="space-y-4">
    <TextField label="Link gambar" value={p.src} onChange={v => set("src", v)} placeholder="https://..." help="Untuk versi awal, cukup tempel link gambar. Upload media bisa ditambahkan kemudian." />
    <TextField label="Keterangan gambar" value={p.alt} onChange={v => set("alt", v)} placeholder="Contoh: Interior Cafe Flow" />
    <TextField label="Caption (opsional)" value={p.caption} onChange={v => set("caption", v)} />
  </div>;

  if (block.type === "button") return <div className="space-y-4">
    <TextField label="Teks tombol" value={p.label} onChange={v => set("label", v)} />
    <TextField label="Link tujuan" value={p.url} onChange={v => set("url", v)} placeholder="https://... atau /contact" />
    <SelectField label="Gaya tombol" value={p.style} onChange={v => set("style", v)}>
      <option value="primary">Utama</option><option value="secondary">Sekunder</option><option value="outline">Outline</option>
    </SelectField>
    <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Buka di tab baru</span><Switch checked={!!p.newTab} onCheckedChange={v => set("newTab", v)} /></label>
  </div>;

  if (block.type === "whatsapp") return <div className="space-y-4">
    <TextField label="Teks tombol" value={p.label} onChange={v => set("label", v)} />
    <TextField label="Nomor WhatsApp" value={p.number} onChange={v => set("number", v)} placeholder="Contoh: 628123456789" help="Gunakan format 62 tanpa tanda + atau spasi." />
    <TextField label="Pesan otomatis" value={p.message} onChange={v => set("message", v)} multi />
  </div>;

  if (block.type === "video") return <div className="space-y-4">
    <TextField label="Judul video" value={p.title} onChange={v => set("title", v)} />
    <TextField label="Link video" value={p.url} onChange={v => set("url", v)} placeholder="YouTube, Vimeo, atau embed URL" />
    <TextField label="Gambar thumbnail (opsional)" value={p.poster} onChange={v => set("poster", v)} />
    <TextField label="Caption (opsional)" value={p.caption} onChange={v => set("caption", v)} />
  </div>;

  if (block.type === "menu") return <div className="space-y-4">
    <TextField label="Judul" value={p.title} onChange={v => set("title", v)} />
    <TextField label="Deskripsi singkat" value={p.subtitle} onChange={v => set("subtitle", v)} />
    <TextField label="Jumlah produk" value={String(p.limit)} onChange={v => set("limit", Math.max(1, Number(v) || 8))} />
    <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Tampilkan harga</span><Switch checked={p.showPrice !== false} onCheckedChange={v => set("showPrice", v)} /></label>
    <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Tampilkan gambar produk</span><Switch checked={p.showImage !== false} onCheckedChange={v => set("showImage", v)} /></label>
  </div>;

  if (block.type === "contact") return <div className="space-y-4">
    <TextField label="Judul" value={p.title} onChange={v => set("title", v)} />
    <TextField label="Deskripsi" value={p.description} onChange={v => set("description", v)} multi />
    {[
      ["showWhatsapp", "Tampilkan WhatsApp"],
      ["showEmail", "Tampilkan email"],
      ["showPhone", "Tampilkan nomor telepon"]
    ].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{label}</span><Switch checked={p[key] !== false} onCheckedChange={v => set(key, v)} /></label>)}
  </div>;

  if (block.type === "location") return <div className="space-y-4">
    <TextField label="Judul" value={p.title} onChange={v => set("title", v)} />
    <TextField label="Alamat" value={p.address} onChange={v => set("address", v)} multi />
    <TextField label="Nomor telepon" value={p.phone} onChange={v => set("phone", v)} />
    <TextField label="Link Google Maps" value={p.mapUrl} onChange={v => set("mapUrl", v)} placeholder="https://maps.google.com/..." />
    <TextField label="Jam operasional" value={p.hours} onChange={v => set("hours", v)} multi placeholder={"Contoh:\\nSenin–Jumat 09.00–22.00\\nSabtu–Minggu 10.00–23.00"} />
  </div>;

  if (block.type === "careers") return <div className="space-y-4">
    <TextField label="Judul" value={p.title} onChange={v => set("title", v)} />
    <TextField label="Deskripsi" value={p.description} onChange={v => set("description", v)} multi />
    <TextField label="Jumlah lowongan yang ditampilkan" value={String(p.limit)} onChange={v => set("limit", Math.max(1, Number(v) || 6))} />
  </div>;

  if (block.type === "spacer") return <TextField label="Tinggi jarak (px)" value={String(p.height)} onChange={v => set("height", Math.max(0, Number(v) || 0))} />;

  if (block.type === "divider") return <SelectField label="Gaya garis" value={p.style} onChange={v => set("style", v)}>
    <option value="line">Garis</option><option value="space">Tanpa garis</option>
  </SelectField>;

  if (block.type === "gallery" || block.type === "cards" || block.type === "faq") {
    return <JsonListEditor block={block} onChange={onChange} />;
  }

  return null;
}

function JsonListEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const p = block.props;
  const items = Array.isArray(p.items) ? p.items : [];
  const update = (index: number, key: string, value: string) =>
    onChange({ ...block, props: { ...p, items: items.map((item: any, i: number) => i === index ? { ...item, [key]: value } : item) } });
  const add = () => {
    const item = block.type === "faq"
      ? { question: "Pertanyaan baru", answer: "Jawaban baru" }
      : block.type === "cards"
        ? { title: "Judul", description: "Deskripsi", image: "", url: "#" }
        : { image: "", title: "Judul foto", caption: "" };
    onChange({ ...block, props: { ...p, items: [...items, item] } });
  };
  return <div className="space-y-4">
    {block.type !== "faq" && <TextField label="Judul section" value={p.title} onChange={v => onChange({ ...block, props: { ...p, title: v } })} />}
    <div className="space-y-3">
      {items.map((item: any, i: number) => <div key={i} className="rounded-xl border p-3">
        <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{block.type === "faq" ? `Pertanyaan ${i + 1}` : block.type === "cards" ? `Kartu ${i + 1}` : `Foto ${i + 1}`}</p><Button size="sm" variant="ghost" className="text-destructive" onClick={() => onChange({ ...block, props: { ...p, items: items.filter((_, n) => n !== i) } })}><Trash2 className="mr-1 size-3" />Hapus</Button></div>
        {block.type === "faq" ? <>
          <div className="space-y-3"><TextField label="Pertanyaan" value={item.question} onChange={v => update(i, "question", v)} /><TextField label="Jawaban" value={item.answer} onChange={v => update(i, "answer", v)} multi /></div>
        </> : block.type === "cards" ? <>
          <div className="space-y-3"><TextField label="Judul" value={item.title} onChange={v => update(i, "title", v)} /><TextField label="Deskripsi" value={item.description} onChange={v => update(i, "description", v)} multi /><TextField label="Gambar (opsional)" value={item.image} onChange={v => update(i, "image", v)} /><TextField label="Link (opsional)" value={item.url} onChange={v => update(i, "url", v)} /></div>
        </> : <>
          <div className="space-y-3"><TextField label="Link gambar" value={item.image} onChange={v => update(i, "image", v)} /><TextField label="Judul foto" value={item.title} onChange={v => update(i, "title", v)} /><TextField label="Caption" value={item.caption} onChange={v => update(i, "caption", v)} /></div>
        </>}
      </div>)}
    </div>
    <Button variant="outline" className="w-full" onClick={add}><Plus className="mr-2 size-4" />Tambah item</Button>
  </div>;
}

function BlockPreview({ block }: { block: Block }) {
  const p = block.props;
  if (block.type === "hero") return <section className="overflow-hidden rounded-xl bg-stone-100 p-7"><div className={p.align === "center" ? "mx-auto max-w-2xl text-center" : p.align === "right" ? "ml-auto max-w-2xl text-right" : "max-w-2xl"}>{p.eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{p.eyebrow}</p>}<h2 className="mt-2 text-3xl font-bold">{p.title}</h2><p className="mt-3 text-sm text-muted-foreground">{p.description}</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-stone-900 px-4 py-2 text-xs text-white">{p.primaryLabel || "Tombol"}</span>{p.secondaryLabel && <span className="rounded-full border px-4 py-2 text-xs">{p.secondaryLabel}</span>}</div></div></section>;
  if (block.type === "image") return <div>{p.src ? <img src={p.src} alt={p.alt || ""} className="max-h-72 w-full rounded-2xl object-cover" /> : <div className="grid h-40 place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">Gambar belum diisi</div>}{p.caption && <p className="mt-2 text-center text-xs text-muted-foreground">{p.caption}</p>}</div>;
  if (block.type === "text") return <section className={`px-5 py-7 ${p.align === "center" ? "text-center" : p.align === "right" ? "text-right" : ""}`}>{p.eyebrow && <p className="text-xs font-bold uppercase text-primary">{p.eyebrow}</p>}<h2 className="mt-2 text-2xl font-bold">{p.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{p.body}</p></section>;
  if (block.type === "whatsapp") return <div className="rounded-2xl border p-5"><MessageCircle className="size-6" /><h3 className="mt-2 font-bold">{p.label}</h3><p className="text-xs text-muted-foreground">WhatsApp: {p.number || "belum diisi"}</p></div>;
  if (block.type === "menu") return <div className="rounded-2xl border p-5"><ShoppingBag className="size-6" /><h3 className="mt-2 text-xl font-bold">{p.title}</h3><p className="text-sm text-muted-foreground">{p.subtitle}</p><div className="mt-4 grid grid-cols-3 gap-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted" />)}</div></div>;
  if (block.type === "gallery") return <div className="rounded-2xl border p-5"><h3 className="text-xl font-bold">{p.title}</h3><div className="mt-3 grid grid-cols-3 gap-2">{(p.items ?? []).slice(0,3).map((x:any,i:number) => x.image ? <img key={i} src={x.image} className="aspect-square rounded-xl object-cover" /> : <div key={i} className="aspect-square rounded-xl bg-muted" />)}</div></div>;
  if (block.type === "video") return <div className="rounded-2xl border p-5"><Video className="size-6" /><h3 className="mt-2 font-bold">{p.title}</h3><div className="mt-3 grid h-28 place-items-center rounded-xl bg-muted text-xs">{p.url || "Link video belum diisi"}</div></div>;
  if (block.type === "cards") return <div className="rounded-2xl border p-5"><h3 className="text-xl font-bold">{p.title}</h3><div className="mt-3 grid grid-cols-2 gap-3">{(p.items ?? []).slice(0,2).map((x:any,i:number) => <div key={i} className="rounded-xl border p-3"><div className="h-16 rounded-lg bg-muted" /><p className="mt-2 font-semibold">{x.title}</p></div>)}</div></div>;
  if (block.type === "contact") return <div className="rounded-2xl border p-5"><Phone className="size-6" /><h3 className="mt-2 font-bold">{p.title}</h3><p className="text-sm text-muted-foreground">{p.description}</p></div>;
  if (block.type === "location") return <div className="rounded-2xl border p-5"><MapPin className="size-6" /><h3 className="mt-2 font-bold">{p.title}</h3><p className="text-sm text-muted-foreground">{p.address || "Alamat belum diisi"}</p></div>;
  if (block.type === "faq") return <div className="rounded-2xl border p-5"><h3 className="text-xl font-bold">{p.title}</h3>{(p.items ?? []).slice(0,2).map((x:any,i:number) => <div key={i} className="mt-3 rounded-xl bg-muted p-3 text-sm"><b>{x.question}</b><p className="mt-1 text-muted-foreground">{x.answer}</p></div>)}</div>;
  if (block.type === "careers") return <div className="rounded-2xl border p-5"><BriefcaseBusiness className="size-6" /><h3 className="mt-2 text-xl font-bold">{p.title}</h3><p className="text-sm text-muted-foreground">{p.description}</p></div>;
  if (block.type === "button") return <div className="p-5"><span className="inline-flex rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground">{p.label}</span></div>;
  if (block.type === "divider") return <div className="px-5 py-5">{p.style === "line" && <hr />}</div>;
  if (block.type === "spacer") return <div style={{ height: Math.min(Number(p.height) || 0, 120) }} className="bg-muted/30" />;
  return null;
}

export function WebsiteBuilder() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPage, setNewPage] = useState({ title: "", slug: "" });
  const [draft, setDraft] = useState<Page | null>(null);

  const pages = useQuery({
    queryKey: ["website-builder-pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("website_pages").select("*").order("sort_order").order("created_at");
      if (error) throw error;
      return (data ?? []) as Page[];
    }
  });

  const open = (page: Page) => {
    setDraft({ ...page, content: page.content ?? { sections: [] }, seo_meta: page.seo_meta ?? {} });
    setSelected(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Belum ada halaman.");
      const payload = {
        title: draft.title.trim(),
        slug: draft.slug.replace(/^\/+/, "").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase(),
        content: { ...(draft.content ?? {}), sections: blocksOf(draft) },
        status: draft.status,
        seo_meta: draft.seo_meta ?? {},
        sort_order: draft.sort_order,
        show_in_navigation: draft.show_in_navigation,
        navigation_label: draft.navigation_label?.trim() || null,
        is_home: draft.is_home,
        template: "builder",
        updated_at: new Date().toISOString()
      };
      if (!payload.title) throw new Error("Nama halaman wajib diisi.");
      if (!payload.slug) throw new Error("Slug halaman wajib diisi.");
      if (payload.is_home) {
        const { error: homeError } = await supabase.from("website_pages").update({ is_home: false }).neq("id", draft.id);
        if (homeError) throw homeError;
      }
      const { error } = await supabase.from("website_pages").upsert(draft.id ? { id: draft.id, ...payload } : payload);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["website-builder-pages"] });
      toast.success("Tersimpan. Website tidak perlu deploy ulang.");
    },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal menyimpan")
  });

  const create = useMutation({
    mutationFn: async () => {
      const title = newPage.title.trim() || "Halaman Baru";
      const slug = (newPage.slug.trim() || title).replace(/^\/+/, "").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
      const count = pages.data?.length ?? 0;
      const { data, error } = await supabase.from("website_pages").insert({
        title, slug, content: { sections: [] }, status: "draft", seo_meta: {}, sort_order: count,
        show_in_navigation: false, is_home: false, template: "builder"
      }).select("*").single();
      if (error) throw error;
      return data as Page;
    },
    onSuccess: page => {
      qc.invalidateQueries({ queryKey: ["website-builder-pages"] });
      setCreateOpen(false);
      setNewPage({ title: "", slug: "" });
      open(page);
    },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal membuat halaman")
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("website_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website-builder-pages"] });
      setDraft(null);
      toast.success("Halaman dihapus.");
    },
    onError: e => toast.error(e instanceof Error ? e.message : "Gagal menghapus")
  });

  const updateBlock = (block: Block) => {
    if (!draft || !selected) return;
    setDraft({ ...draft, content: { ...draft.content, sections: blocksOf(draft).map(x => x.id === selected ? block : x) } });
  };

  const addBlock = (type: BlockType) => {
    if (!draft) return;
    const block = makeBlock(type);
    setDraft({ ...draft, content: { ...draft.content, sections: [...blocksOf(draft), block] } });
    setSelected(block.id);
    setAdding(false);
  };

  const move = (id: string, direction: number) => {
    if (!draft) return;
    const list = [...blocksOf(draft)];
    const i = list.findIndex(x => x.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setDraft({ ...draft, content: { ...draft.content, sections: list } });
  };

  const duplicate = (id: string) => {
    if (!draft) return;
    const list = [...blocksOf(draft)];
    const i = list.findIndex(x => x.id === id);
    if (i < 0) return;
    const copy = { ...list[i], id: crypto.randomUUID(), props: JSON.parse(JSON.stringify(list[i].props)) };
    list.splice(i + 1, 0, copy);
    setDraft({ ...draft, content: { ...draft.content, sections: list } });
    setSelected(copy.id);
  };

  const del = (id: string) => {
    if (!draft) return;
    setDraft({ ...draft, content: { ...draft.content, sections: blocksOf(draft).filter(x => x.id !== id) } });
    if (selected === id) setSelected(null);
  };

  const current = draft && selected ? blocksOf(draft).find(x => x.id === selected) : null;
  const previewUrl = draft ? `${PUBLIC_WEBSITE_URL}/${draft.slug === "home" ? "" : draft.slug}` : PUBLIC_WEBSITE_URL;

  return (
    <AppShell title="Management Website · Website Builder" description="Kelola website tanpa coding">
      <div className="mx-auto max-w-6xl space-y-5">
        {!draft ? (
          <>
            <div className="rounded-2xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><Globe className="size-5 text-primary" /><h2 className="text-xl font-bold">Website Builder</h2></div>
                  <p className="mt-1 text-sm text-muted-foreground">Semua konten website dikelola dari sini. Klien tidak perlu buka GitHub, coding, atau deploy.</p>
                </div>
                <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 size-4" />Tambah Halaman</Button>
              </div>
            </div>

            {showHelp && <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Info className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">Cara pakai — gampang saja</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                      <li>Pilih halaman yang mau diedit.</li>
                      <li>Klik <b>Tambah Section</b> untuk menambah bagian website.</li>
                      <li>Klik <b>Edit</b> pada section lalu ubah teks, gambar, tombol, WhatsApp, dan lainnya.</li>
                      <li>Klik <b>Simpan Perubahan</b>. Perubahan langsung tersimpan ke website — <b>tidak perlu GitHub atau deploy.</b></li>
                      <li>Gunakan <b>Preview Website</b> untuk melihat hasilnya.</li>
                    </ol>
                    <button className="mt-2 text-xs text-primary underline" onClick={() => setShowHelp(false)}>Sembunyikan panduan</button>
                  </div>
                </div>
              </CardContent>
            </Card>}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(pages.data ?? []).map(page => (
                <Card key={page.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button className="min-w-0 flex-1 text-left" onClick={() => open(page)}>
                        <p className="font-semibold">{page.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">/{page.slug}</p>
                      </button>
                      <Badge variant={page.status === "published" ? "default" : "secondary"}>{page.status === "published" ? "Tayang" : "Draft"}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">{blocksOf(page).length} bagian{page.is_home ? " · Home" : ""}{page.show_in_navigation ? " · Menu" : ""}</p>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => open(page)}><Pencil className="mr-1.5 size-3.5" />Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(`${PUBLIC_WEBSITE_URL}/${page.slug === "home" ? "" : page.slug}`, "_blank")}><Eye className="mr-1.5 size-3.5" />Lihat</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm(`Hapus halaman "${page.title}"?`) && remove.mutate(page.id)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!pages.isLoading && (pages.data ?? []).length === 0 && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Belum ada halaman. Klik "Tambah Halaman" untuk mulai.</CardContent></Card>}

            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Pengaturan website</CardTitle></CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <Link className="rounded-lg border p-3 hover:bg-muted" to="/website-management/settings">Branding, logo, SEO & sosial media</Link>
                  <Link className="rounded-lg border p-3 hover:bg-muted" to="/website-management/gallery">Gallery</Link>
                  <Link className="rounded-lg border p-3 hover:bg-muted" to="/website-management/contact">Kontak</Link>
                  <Link className="rounded-lg border p-3 hover:bg-muted" to="/website-management/careers">Lowongan kerja</Link>
                  <Link className="rounded-lg border p-3 hover:bg-muted" to="/website-management/navigation">Menu navigasi</Link>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Catatan penting</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>✏️ Edit konten → 💾 Simpan → 🌐 langsung terlihat di website.</p>
                  <p>GitHub hanya dipakai untuk pengembangan sistem builder, bukan untuk pekerjaan harian klien.</p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={() => setDraft(null)}>← Semua Halaman</Button>
                  <div><p className="font-semibold">{draft.title}</p><p className="text-xs text-muted-foreground">/{draft.slug}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => window.open(previewUrl, "_blank")}><ExternalLink className="mr-2 size-4" />Preview Website</Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />{save.isPending ? "Menyimpan..." : "Simpan Perubahan"}</Button>
                </div>
              </div>
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm font-semibold">Sedang mengedit: {draft.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">Urutan section dari atas ke bawah = urutan tampil di website. Klik <b>Edit</b> untuk mengubah isi. Semua perubahan baru masuk website setelah tombol <b>Simpan Perubahan</b> ditekan.</p>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <Card className="h-fit">
                <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Settings2 className="size-4" />Pengaturan Halaman</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <TextField label="Nama halaman" value={draft.title} onChange={v => setDraft({ ...draft, title: v })} />
                  <TextField label="Alamat halaman (slug)" value={draft.slug} onChange={v => setDraft({ ...draft, slug: v.replace(/^\/+/, "").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() })} help="Contoh: about, careers, contact" />
                  <SelectField label="Status" value={draft.status} onChange={v => setDraft({ ...draft, status: v as "draft" | "published" })}>
                    <option value="published">Tayang di website</option><option value="draft">Simpan sebagai draft</option>
                  </SelectField>
                  <TextField label="Nama di menu website" value={draft.navigation_label ?? ""} onChange={v => setDraft({ ...draft, navigation_label: v || null })} placeholder="Contoh: Tentang Kami" />
                  <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Tampilkan di menu website</span><Switch checked={!!draft.show_in_navigation} onCheckedChange={v => setDraft({ ...draft, show_in_navigation: v })} /></label>
                  <label className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>Jadikan halaman Home</span><Switch checked={!!draft.is_home} onCheckedChange={v => setDraft({ ...draft, is_home: v })} /></label>
                  <Button variant="destructive" className="w-full" onClick={() => window.confirm(`Hapus halaman "${draft.title}"?`) && remove.mutate(draft.id)}><Trash2 className="mr-2 size-4" />Hapus Halaman</Button>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {blocksOf(draft).map((block, index) => {
                  const meta = blockMeta.find(x => x.type === block.type);
                  return (
                    <Card key={block.id} className={selected === block.id ? "border-primary ring-1 ring-primary/30" : ""}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            {meta ? <meta.icon className="size-4" /> : <Type className="size-4" />}
                          </div>
                          <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(block.id)}>
                            <p className="font-semibold">{index + 1}. {meta?.label ?? block.type}</p>
                            <p className="truncate text-xs text-muted-foreground">{meta?.help ?? "Bagian website"}</p>
                          </button>
                          <div className="flex shrink-0 gap-1">
                            <Button size="sm" variant="outline" onClick={() => setSelected(block.id)}><Pencil className="mr-1 size-3.5" />Edit</Button>
                            <Button size="icon" variant="ghost" aria-label="Naik" onClick={() => move(block.id, -1)}><ChevronUp className="size-4" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Turun" onClick={() => move(block.id, 1)}><ChevronDown className="size-4" /></Button>
                            <Button size="icon" variant="ghost" aria-label="Duplikat" onClick={() => duplicate(block.id)}><Copy className="size-4" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive" aria-label="Hapus" onClick={() => window.confirm("Hapus section ini?") && del(block.id)}><Trash2 className="size-4" /></Button>
                          </div>
                        </div>
                        <div className="mt-3 overflow-hidden rounded-xl border bg-muted/20 p-2"><BlockPreview block={block} /></div>
                      </CardContent>
                    </Card>
                  );
                })}

                <Button variant="outline" className="w-full border-dashed py-6" onClick={() => setAdding(true)}><Plus className="mr-2 size-4" />Tambah Section / Bagian Website</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={!!selected && !!draft} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{current ? `Edit: ${blockMeta.find(x => x.type === current.type)?.label ?? current.type}` : "Edit Section"}</DialogTitle></DialogHeader>
          {current && <BlockEditor block={current} onChange={updateBlock} />}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setSelected(null)}>Selesai</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>Tambah Bagian Website</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Pilih sesuai kebutuhan. Tidak perlu coding.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {["Konten", "Media", "Tampilan", "Bisnis"].map(group => (
              <div key={group} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group}</p>
                {blockMeta.filter(x => x.group === group).map(meta => {
                  const Icon = meta.icon;
                  return <button key={meta.type} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-primary hover:bg-primary/5" onClick={() => addBlock(meta.type)}>
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
                    <div><p className="text-sm font-semibold">{meta.label}</p><p className="text-xs text-muted-foreground">{meta.help}</p></div>
                  </button>;
                })}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Tambah Halaman Baru</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Contoh: Tentang Kami, Karier, Promo, Galeri, atau halaman apa pun yang dibutuhkan.</p>
            <TextField label="Nama halaman" value={newPage.title} onChange={v => setNewPage({ ...newPage, title: v })} placeholder="Contoh: Tentang Kami" />
            <TextField label="Alamat halaman" value={newPage.slug} onChange={v => setNewPage({ ...newPage, slug: v })} placeholder="Contoh: tentang-kami" help="Boleh dikosongkan; sistem akan membuat dari nama halaman." />
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button><Button onClick={() => create.mutate()} disabled={create.isPending}><Plus className="mr-2 size-4" />Buat Halaman</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
