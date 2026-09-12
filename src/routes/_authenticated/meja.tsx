import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, QrCode, Users, CheckCircle2, Pencil, Trash2, ExternalLink, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchTables, type RestaurantTable } from "@/lib/pos";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/meja")({ component: TablesPage });

type Form = { id?: string; name: string; code: string };
const EMPTY: Form = { name: "", code: "" };

function TablesPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["tables"], queryFn: fetchTables, refetchInterval: 10000 });
  const tables = query.data ?? [];
  const [open, setOpen] = useState(false);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  function menuUrl(table: RestaurantTable) { return `${window.location.origin}/menu?table=${encodeURIComponent(table.code)}`; }
  function qrUrl(table: RestaurantTable) { return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=12&data=${encodeURIComponent(menuUrl(table))}`; }
  function openNew() { setForm({ name: `Meja ${tables.length + 1}`, code: `M${tables.length + 1}` }); setOpen(true); }
  function openEdit(table: RestaurantTable) { setForm({ id: table.id, name: table.name, code: table.code }); setOpen(true); }
  async function copyQr(table: RestaurantTable) { await navigator.clipboard.writeText(menuUrl(table)); toast.success("Link QR disalin"); }

  const save = useMutation({ mutationFn: async () => { const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase() }; if (!payload.name || !payload.code) throw new Error("Nama dan kode meja wajib diisi"); const q = form.id ? supabase.from("restaurant_tables").update(payload).eq("id", form.id) : supabase.from("restaurant_tables").insert(payload); const { error } = await q; if (error) throw error; }, onSuccess: () => { setOpen(false); void qc.invalidateQueries({ queryKey: ["tables"] }); toast.success("Meja tersimpan"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan meja") });
  const remove = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("restaurant_tables").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tables"] }); toast.success("Meja dihapus"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menghapus meja") });

  return <AppShell title="Meja & QR Menu" description="Kelola meja, status, dan QR ordering" actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button><Button size="sm" onClick={openNew}><Plus className="mr-2 size-4" />Tambah Meja</Button></div>}>
    <div className="mb-4 grid gap-3 sm:grid-cols-3"><Card><CardContent className="flex items-center gap-3 p-4"><CheckCircle2 className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Total meja</p><p className="text-xl font-bold">{tables.length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><Users className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">QR aktif</p><p className="text-xl font-bold">{tables.length}</p></div></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><QrCode className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Siap dipakai</p><p className="text-xl font-bold">{tables.length}</p></div></CardContent></Card></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{tables.map((table) => <Card key={table.id} className="overflow-hidden"><CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle>{table.name}</CardTitle><Badge variant="secondary">Kosong</Badge></div></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Kode: {table.code}</p><Button className="w-full" variant="outline" onClick={() => setQrTable(table)}><QrCode className="mr-2 size-4" />Lihat QR Menu</Button><div className="flex gap-2"><Button size="sm" variant="ghost" className="flex-1" onClick={() => openEdit(table)}><Pencil className="mr-2 size-4" />Edit</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm(`Hapus ${table.name}?`)) remove.mutate(table.id); }}><Trash2 className="size-4" /></Button></div></CardContent></Card>)}{tables.length === 0 && <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4"><CardContent className="py-14 text-center text-sm text-muted-foreground">Belum ada meja. Klik Tambah Meja untuk membuat QR pertama.</CardContent></Card>}</div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{form.id ? "Edit meja" : "Tambah meja"}</DialogTitle><DialogDescription>Setiap meja memiliki kode unik yang dipakai pada QR ordering.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><div className="space-y-2"><Label>Nama meja</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="space-y-2"><Label>Kode QR</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></div><Button className="w-full" disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan meja"}</Button></form></DialogContent></Dialog>

    <Dialog open={!!qrTable} onOpenChange={(v) => !v && setQrTable(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>QR Menu — {qrTable?.name}</DialogTitle><DialogDescription>Scan QR ini untuk membuka menu dan order dari meja.</DialogDescription></DialogHeader>{qrTable && <div className="space-y-4 text-center"><div className="mx-auto w-fit rounded-2xl border bg-white p-3"><img src={qrUrl(qrTable)} alt={`QR ${qrTable.name}`} className="size-72" /></div><p className="break-all rounded-lg bg-muted p-2 text-xs text-muted-foreground">{menuUrl(qrTable)}</p><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => copyQr(qrTable)}><Copy className="mr-2 size-4" />Salin link</Button><Button onClick={() => window.open(menuUrl(qrTable), "_blank", "noopener,noreferrer")}><ExternalLink className="mr-2 size-4" />Buka menu</Button></div></div>}</DialogContent></Dialog>
  </AppShell>;
}
