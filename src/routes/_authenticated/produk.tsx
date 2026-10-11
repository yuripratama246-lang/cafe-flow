import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, AlertTriangle, Coffee, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { rupiah } from "@/lib/format";
import { fetchCategories, fetchProducts, type Product } from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/produk")({ component: ProdukPage });

type FormState = { id?: string; name: string; description: string; price: string; image_url: string; category_id: string; stock: string; low_stock_threshold: string; show_on_menu: boolean; is_active: boolean };
type AddonDraft = { name: string; price: string; is_active: boolean };
type CustomOptionDraft = { group_key: "sugar" | "ice" | "size"; name: string; price_delta: string; is_active: boolean };
const EMPTY_ADDON: AddonDraft = { name: "", price: "0", is_active: true };
const DEFAULT_DRINK_OPTIONS: CustomOptionDraft[] = [
  { group_key: "sugar", name: "Normal Sugar", price_delta: "0", is_active: true },
  { group_key: "sugar", name: "Less Sugar", price_delta: "0", is_active: true },
  { group_key: "ice", name: "Normal Ice", price_delta: "0", is_active: true },
  { group_key: "ice", name: "Less Ice", price_delta: "0", is_active: true },
  { group_key: "ice", name: "Hot", price_delta: "0", is_active: true },
  { group_key: "size", name: "Regular", price_delta: "0", is_active: true },
  { group_key: "size", name: "Large", price_delta: "8000", is_active: true },
];
const DRINK_CATEGORY = /(coffee|non[- ]?coffee|drink|beverage|minuman|kopi)/i;
const EMPTY: FormState = { name: "", description: "", price: "", image_url: "", category_id: "none", stock: "0", low_stock_threshold: "5", show_on_menu: true, is_active: true };

function ProdukPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const [open, setOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [addons, setAddons] = useState<AddonDraft[]>([]); const [customOptions, setCustomOptions] = useState<CustomOptionDraft[]>([]);
  const categories = categoriesQuery.data ?? [];
  const addCategory = useMutation({ mutationFn: async () => { const name = newCategoryName.trim(); if (!name) throw new Error("Nama kategori wajib diisi"); if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new Error("Kategori sudah ada"); const { error } = await supabase.from("categories").insert({ name, sort_order: categories.length ? Math.max(...categories.map((x) => x.sort_order)) + 1 : 1 }); if (error) throw error; }, onSuccess: async () => { setNewCategoryName(""); await queryClient.invalidateQueries({ queryKey: ["categories"] }); toast.success("Kategori berhasil ditambahkan"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menambahkan kategori") });
  const products = productsQuery.data ?? [];
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  function resetImage() { setImageFile(null); setImagePreview(form.image_url); }
  function openNew() { setForm(EMPTY); setAddons([]); setCustomOptions([]); setImageFile(null); setImagePreview(""); setOpen(true); }
  async function openEdit(p: Product) { setForm({ id: p.id, name: p.name, description: p.description ?? "", price: String(p.price), image_url: p.image_url ?? "", category_id: p.category_id ?? "none", stock: String(p.stock), low_stock_threshold: String(p.low_stock_threshold), show_on_menu: p.show_on_menu, is_active: p.is_active }); setImageFile(null); setImagePreview(p.image_url ?? ""); setOpen(true); const { data, error } = await supabase.from("product_addons").select("name, price, is_active").eq("product_id", p.id).order("created_at"); if (error) { toast.error("Gagal memuat topping produk"); setAddons([]); } else setAddons((data ?? []).map((a) => ({ name: a.name, price: String(a.price), is_active: a.is_active }))); const { data: options, error: optionsError } = await supabase.from("product_customization_options").select("group_key, name, price_delta, is_active").eq("product_id", p.id).order("sort_order"); if (optionsError) { toast.error("Gagal memuat opsi kustomisasi"); setCustomOptions([]); } else setCustomOptions((options ?? []).length ? (options ?? []).map((o) => ({ group_key: o.group_key as CustomOptionDraft["group_key"], name: o.name, price_delta: String(o.price_delta), is_active: o.is_active })) : (DRINK_CATEGORY.test(categories.find((c) => c.id === p.category_id)?.name ?? "") ? DEFAULT_DRINK_OPTIONS.map((o) => ({ ...o })) : [])); }
  function onImageChange(file: File | null) { if (!file) return; if (!file.type.startsWith("image/")) { toast.error("Pilih file gambar"); return; } if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran gambar maksimal 5 MB"); return; } setImageFile(file); setImagePreview(URL.createObjectURL(file)); }

  const save = useMutation({
    mutationFn: async () => {
      let imageUrl = form.image_url.trim() || null;
      if (imageFile) {
        const safe = imageFile.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
        const path = `${crypto.randomUUID()}-${safe}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(path, imageFile, { upsert: false, contentType: imageFile.type });
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      const payload = { name: form.name.trim(), description: form.description.trim() || null, price: Number(form.price) || 0, image_url: imageUrl, category_id: form.category_id === "none" ? null : form.category_id, stock: Number(form.stock) || 0, low_stock_threshold: Number(form.low_stock_threshold) || 0, show_on_menu: form.show_on_menu, is_active: form.is_active };
      let productId = form.id;
      if (productId) { const { error } = await supabase.from("products").update(payload).eq("id", productId); if (error) throw error; }
      else { const { data, error } = await supabase.from("products").insert(payload).select("id").single(); if (error) throw error; productId = data.id; }
      if (!productId) throw new Error("ID produk tidak ditemukan");
      const { error: removeError } = await supabase.from("product_addons").delete().eq("product_id", productId); if (removeError) throw removeError;
      const addonRows = addons.filter((a) => a.name.trim()).map((a) => ({ product_id: productId, name: a.name.trim(), price: Math.max(0, Number(a.price) || 0), is_active: a.is_active }));
      if (addonRows.length) { const { error } = await supabase.from("product_addons").insert(addonRows); if (error) throw error; }
      const { error: optionRemoveError } = await supabase.from("product_customization_options").delete().eq("product_id", productId); if (optionRemoveError) throw optionRemoveError;
      const optionRows = customOptions.filter((o) => o.name.trim()).map((o, index) => ({ product_id: productId, group_key: o.group_key, name: o.name.trim(), price_delta: Math.max(0, Number(o.price_delta) || 0), is_active: o.is_active, sort_order: index }));
      if (optionRows.length) { const { error } = await supabase.from("product_customization_options").insert(optionRows); if (error) throw error; }
    },
    onSuccess: () => { setOpen(false); setImageFile(null); void queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Produk tersimpan"); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan produk"),
  });

  const toggleMenu = useMutation({ mutationFn: async ({ id, value }: { id: string; value: boolean }) => { const { error } = await supabase.from("products").update({ show_on_menu: value }).eq("id", id); if (error) throw error; }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["products"] }), onError: () => toast.error("Gagal mengubah status QR menu") });

  return <AppShell title="Produk & Inventori" description="Kelola menu, harga, gambar, dan stok" actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>Kelola kategori</Button><Button onClick={openNew}><Plus className="size-4" /> Tambah produk</Button></div>}>
    {productsQuery.isLoading ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div> : <Card><CardContent className="p-0"><ul className="divide-y divide-border">{products.map((p) => { const low = p.stock <= p.low_stock_threshold; return <li key={p.id} className="flex flex-wrap items-center gap-3 p-4"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">{p.image_url ? <img src={p.image_url} alt={p.name} className="size-full object-cover" /> : <Coffee className="size-5 text-muted-foreground/60" />}</div><div className="min-w-40 flex-1"><div className="flex items-center gap-2"><p className="truncate font-medium">{p.name}</p>{!p.is_active && <Badge variant="outline">Nonaktif</Badge>}</div><p className="text-xs text-muted-foreground">{categoryName(p.category_id)}</p></div><p className="num w-28 text-sm font-semibold">{rupiah(p.price)}</p><div className="w-28"><Badge variant={low ? "destructive" : "secondary"} className="gap-1">{low && <AlertTriangle className="size-3" />}stok {p.stock}</Badge></div><div className="flex items-center gap-2"><Switch checked={p.show_on_menu} onCheckedChange={(v) => toggleMenu.mutate({ id: p.id, value: v })} /><span className="hidden text-xs text-muted-foreground sm:inline">QR menu</span></div><Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button></li>; })}</ul></CardContent></Card>}

    <Dialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen}><DialogContent><DialogHeader><DialogTitle>Kelola kategori menu</DialogTitle><DialogDescription>Tambah kategori yang tersedia di produk dan QR Order.</DialogDescription></DialogHeader><form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addCategory.mutate(); }}><Input placeholder="Contoh: Alcohol, Dessert, Main Course" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /><Button type="submit" disabled={addCategory.isPending}><Plus className="mr-1 size-4" />Tambah</Button></form><div className="space-y-2"><p className="text-sm font-medium">Kategori saat ini</p>{categories.map((category) => <div key={category.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span>{category.name}</span><Badge variant="secondary">Aktif</Badge></div>)}</div></DialogContent></Dialog>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="min-w-0"><DialogHeader><DialogTitle>{form.id ? "Edit produk" : "Produk baru"}</DialogTitle><DialogDescription>Kelola detail menu tanpa URL gambar. Pilih foto langsung dari galeri/perangkat.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return toast.error("Nama produk wajib diisi"); save.mutate(); }}>
        <div className="space-y-2"><Label>Foto produk</Label><div className="flex gap-3 rounded-xl border border-dashed p-3"><div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">{imagePreview ? <img src={imagePreview} alt="Preview" className="size-full object-cover" /> : <ImagePlus className="size-7 text-muted-foreground" />}</div><div className="flex min-w-0 flex-1 flex-col justify-center gap-2"><Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => onImageChange(e.target.files?.[0] ?? null)} className="cursor-pointer" />{imagePreview && <Button type="button" size="sm" variant="ghost" className="w-fit" onClick={resetImage}><Trash2 className="mr-2 size-4" />Hapus foto baru</Button>}<p className="text-xs text-muted-foreground">JPG/PNG/WebP, maksimal 5 MB.</p></div></div></div>
        <div className="space-y-2"><Label htmlFor="name">Nama</Label><Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="desc">Deskripsi</Label><Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Harga (Rp)</Label><Input inputMode="numeric" required className="num" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div><div className="space-y-2"><Label>Kategori</Label><Select value={form.category_id} onValueChange={(v) => { setForm({ ...form, category_id: v }); if (isDrinkCategory(v) && customOptions.length === 0) setCustomOptions(DEFAULT_DRINK_OPTIONS.map((o) => ({ ...o }))); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa kategori</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Stok</Label><Input inputMode="numeric" className="num" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div><div className="space-y-2"><Label>Ambang stok menipis</Label><Input inputMode="numeric" className="num" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} /></div></div>
        <section className="space-y-3 rounded-xl border p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Tambahan / topping</p><p className="text-xs text-muted-foreground">Atur nama, harga, dan status topping yang tampil saat pelanggan memilih produk ini.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setAddons((old) => [...old, { ...EMPTY_ADDON }])}><Plus className="mr-1 size-4" />Tambah</Button></div>{addons.map((addon, index) => <div key={index} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_110px_auto_auto]"><Input aria-label="Nama topping" placeholder="Nama topping" value={addon.name} onChange={(e) => setAddons((old) => old.map((a, i) => i === index ? { ...a, name: e.target.value } : a))} /><Input aria-label="Harga topping" inputMode="numeric" placeholder="Harga" value={addon.price} onChange={(e) => setAddons((old) => old.map((a, i) => i === index ? { ...a, price: e.target.value } : a))} /><Switch checked={addon.is_active} onCheckedChange={(v) => setAddons((old) => old.map((a, i) => i === index ? { ...a, is_active: v } : a))} aria-label="Aktifkan topping" /><Button type="button" size="icon" variant="ghost" aria-label="Hapus topping" onClick={() => setAddons((old) => old.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}{addons.length === 0 && <p className="text-xs text-muted-foreground">Belum ada topping tambahan untuk produk ini.</p>}</section>
        <section className="space-y-3 rounded-xl border p-3"><div><p className="text-sm font-semibold">Opsi kustomisasi minuman</p><p className="text-xs text-muted-foreground">Atur pilihan gula, es, dan ukuran. Harga tambahan bisa diatur per opsi (0 jika tanpa biaya).</p></div>{customOptions.map((option, index) => <div key={index} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[105px_1fr_95px_auto_auto]"><select aria-label="Kelompok opsi" className="h-10 rounded-md border bg-background px-2 text-sm" value={option.group_key} onChange={(e) => setCustomOptions((old) => old.map((o, i) => i === index ? { ...o, group_key: e.target.value as CustomOptionDraft["group_key"] } : o))}><option value="sugar">Gula</option><option value="ice">Es</option><option value="size">Ukuran</option></select><Input aria-label="Nama opsi" placeholder="Nama pilihan" value={option.name} onChange={(e) => setCustomOptions((old) => old.map((o, i) => i === index ? { ...o, name: e.target.value } : o))} /><Input aria-label="Biaya tambahan" inputMode="numeric" placeholder="+Rp" value={option.price_delta} onChange={(e) => setCustomOptions((old) => old.map((o, i) => i === index ? { ...o, price_delta: e.target.value } : o))} /><Switch checked={option.is_active} onCheckedChange={(v) => setCustomOptions((old) => old.map((o, i) => i === index ? { ...o, is_active: v } : o))} aria-label="Aktifkan opsi" /><Button type="button" size="icon" variant="ghost" aria-label="Hapus opsi" onClick={() => setCustomOptions((old) => old.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}<Button type="button" size="sm" variant="outline" onClick={() => setCustomOptions((old) => [...old, { group_key: "size", name: "", price_delta: "0", is_active: true }])}><Plus className="mr-1 size-4" />Tambah opsi</Button></section><div className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-medium">Tampilkan di QR menu</p><p className="text-xs text-muted-foreground">Terlihat pelanggan</p></div><Switch checked={form.show_on_menu} onCheckedChange={(v) => setForm({ ...form, show_on_menu: v })} /></div>
        <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-medium">Produk aktif</p><p className="text-xs text-muted-foreground">Bisa dijual di kasir</p></div><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>
        <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan produk"}</Button>
      </form>
    </DialogContent></Dialog>
  </AppShell>;
}
