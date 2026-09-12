import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, AlertTriangle, Coffee } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { rupiah } from "@/lib/format";
import { fetchCategories, fetchProducts, type Product } from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/produk")({
  head: () => ({
    meta: [
      { title: "Produk & Stok — Kasirku POS" },
      { name: "description", content: "Kelola menu kafe: harga, foto, kategori, stok, ambang stok menipis, dan tampilkan di QR menu." },
      { property: "og:title", content: "Produk & Stok — Kasirku POS" },
      { property: "og:description", content: "Kelola menu, harga, stok, dan tampilan QR menu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProdukPage,
});

type FormState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
  category_id: string;
  stock: string;
  low_stock_threshold: string;
  show_on_menu: boolean;
  is_active: boolean;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  price: "",
  image_url: "",
  category_id: "none",
  stock: "0",
  low_stock_threshold: "5",
  show_on_menu: true,
  is_active: true,
};

function ProdukPage() {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const categories = categoriesQuery.data ?? [];
  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  function openNew() {
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      image_url: p.image_url ?? "",
      category_id: p.category_id ?? "none",
      stock: String(p.stock),
      low_stock_threshold: String(p.low_stock_threshold),
      show_on_menu: p.show_on_menu,
      is_active: p.is_active,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price) || 0,
        image_url: form.image_url.trim() || null,
        category_id: form.category_id === "none" ? null : form.category_id,
        stock: Number(form.stock) || 0,
        low_stock_threshold: Number(form.low_stock_threshold) || 0,
        show_on_menu: form.show_on_menu,
        is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produk tersimpan");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal menyimpan produk"),
  });

  const toggleMenu = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("products").update({ show_on_menu: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const products = productsQuery.data ?? [];

  return (
    <AppShell
      title="Produk & Inventori"
      description="Kelola menu, harga, dan stok"
      actions={
        <Button onClick={openNew}>
          <Plus className="size-4" /> Tambah produk
        </Button>
      }
    >
      {productsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {products.map((p) => {
                const low = p.stock <= p.low_stock_threshold;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="size-full object-cover" />
                      ) : (
                        <Coffee className="size-5 text-muted-foreground/60" />
                      )}
                    </div>
                    <div className="min-w-40 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{p.name}</p>
                        {!p.is_active ? <Badge variant="outline">Nonaktif</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{categoryName(p.category_id)}</p>
                    </div>
                    <p className="num w-28 text-sm font-semibold">{rupiah(p.price)}</p>
                    <div className="w-28">
                      <Badge variant={low ? "destructive" : "secondary"} className="gap-1">
                        {low ? <AlertTriangle className="size-3" /> : null}
                        stok {p.stock}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.show_on_menu}
                        onCheckedChange={(v) => toggleMenu.mutate({ id: p.id, value: v })}
                        aria-label="Tampilkan di QR menu"
                      />
                      <span className="hidden text-xs text-muted-foreground sm:inline">QR menu</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit produk" : "Produk baru"}</DialogTitle>
            <DialogDescription>Lengkapi detail menu dan stok.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Deskripsi</Label>
              <Textarea
                id="desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Harga (Rp)</Label>
                <Input
                  id="price"
                  inputMode="numeric"
                  required
                  className="num"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa kategori</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stok</Label>
                <Input
                  id="stock"
                  inputMode="numeric"
                  className="num"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="low">Ambang stok menipis</Label>
                <Input
                  id="low"
                  inputMode="numeric"
                  className="num"
                  value={form.low_stock_threshold}
                  onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">URL gambar</Label>
              <Input
                id="image"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Tampilkan di QR menu</p>
                <p className="text-xs text-muted-foreground">Terlihat oleh pelanggan</p>
              </div>
              <Switch
                checked={form.show_on_menu}
                onCheckedChange={(v) => setForm({ ...form, show_on_menu: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Produk aktif</p>
                <p className="text-xs text-muted-foreground">Bisa dijual di kasir</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={save.isPending}>
              {save.isPending ? "Menyimpan…" : "Simpan produk"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
