import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Receipt, Percent, Save, Store, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pengaturan")({ component: PengaturanPage });

type Settings = { id?: string; owner_id: string; name: string; address: string; phone: string; tax_rate: number; service_rate: number; rounding: number; receipt_note: string; receipt_footer: string; transaction_prefix: string; cash_enabled: boolean; card_enabled: boolean; qris_enabled: boolean };
const DEFAULTS = { name: "Outlet Utama", address: "", phone: "", tax_rate: 11, service_rate: 0, rounding: 0, receipt_note: "", receipt_footer: "Terima kasih sudah berkunjung.", transaction_prefix: "CF", cash_enabled: true, card_enabled: true, qris_enabled: true };

async function getOwnerId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Belum login");
  return data.user.id;
}

function PengaturanPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["outlet-settings"],
    queryFn: async () => {
      const ownerId = await getOwnerId();
      const { data, error } = await supabase.from("outlet_settings").select("*").eq("owner_id", ownerId).maybeSingle();
      if (error) throw error;
      if (data) return data as Settings;
      const initial = { owner_id: ownerId, ...DEFAULTS } as Settings;
      const { data: created, error: createError } = await supabase.from("outlet_settings").upsert(initial, { onConflict: "owner_id" }).select("*").single();
      if (createError) throw createError;
      return created as Settings;
    },
    retry: 1,
  });
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const save = useMutation({ mutationFn: async () => { if (!form) return; const { error } = await supabase.from("outlet_settings").upsert(form, { onConflict: "owner_id" }); if (error) throw error; }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["outlet-settings"] }); toast.success("Pengaturan outlet tersimpan"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan pengaturan") });

  if (query.isError) return <AppShell title="Pengaturan Outlet" description="Atur identitas bisnis, checkout, pembayaran, struk, dan notifikasi"><Card><CardContent className="py-12 text-center"><p className="font-medium">Pengaturan gagal dimuat</p><p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : "Terjadi kesalahan saat membaca pengaturan."}</p><Button className="mt-4" onClick={() => query.refetch()}>Coba lagi</Button></CardContent></Card></AppShell>;
  if (!form) return <AppShell title="Pengaturan Outlet" description="Atur identitas bisnis, checkout, pembayaran, struk, dan notifikasi"><div className="grid gap-4 md:grid-cols-2"><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Memuat pengaturan outlet…</CardContent></Card></div></AppShell>;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm({ ...form, [key]: value });

  return <AppShell title="Pengaturan Outlet" description="Atur identitas bisnis, checkout, pembayaran, struk, dan notifikasi" actions={<Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />{save.isPending ? "Menyimpan…" : "Simpan perubahan"}</Button>}>
    <div className="grid gap-4 md:grid-cols-4"><Stat icon={Store} label="Outlet" value="1" note="Outlet aktif" /><Stat icon={Percent} label="Pajak" value={`${form.tax_rate}%`} note="Checkout" /><Stat icon={CreditCard} label="Payment" value={String([form.cash_enabled, form.card_enabled, form.qris_enabled].filter(Boolean).length)} note="Metode aktif" /><Stat icon={Receipt} label="Struk" value={form.transaction_prefix} note="Prefix transaksi" /></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />Profil outlet</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Nama outlet</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div><div className="space-y-2"><Label>Alamat</Label><Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={3} /></div><div className="space-y-2"><Label>No. WhatsApp / Telepon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Percent className="size-5" />Checkout & pajak</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Pajak %</Label><Input type="number" min="0" value={form.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value))} /></div><div className="space-y-2"><Label>Service %</Label><Input type="number" min="0" value={form.service_rate} onChange={(e) => set("service_rate", Number(e.target.value))} /></div><div className="space-y-2"><Label>Pembulatan</Label><Input type="number" min="0" value={form.rounding} onChange={(e) => set("rounding", Number(e.target.value))} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5" />Metode pembayaran</CardTitle></CardHeader><CardContent className="space-y-3"><PaymentRow label="Tunai" description="Terima pembayaran cash di kasir" checked={form.cash_enabled} onChange={(v) => set("cash_enabled", v)} /><PaymentRow label="Kartu" description="Pembayaran kartu/debit" checked={form.card_enabled} onChange={(v) => set("card_enabled", v)} /><PaymentRow label="QRIS" description="Pembayaran QRIS" checked={form.qris_enabled} onChange={(v) => set("qris_enabled", v)} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-5" />Struk & transaksi</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Prefix nomor transaksi</Label><Input value={form.transaction_prefix} onChange={(e) => set("transaction_prefix", e.target.value.toUpperCase())} maxLength={8} /></div><div className="space-y-2"><Label>Catatan struk</Label><Textarea value={form.receipt_note} onChange={(e) => set("receipt_note", e.target.value)} rows={2} /></div><div className="space-y-2"><Label>Footer struk</Label><Textarea value={form.receipt_footer} onChange={(e) => set("receipt_footer", e.target.value)} rows={2} /></div></CardContent></Card>
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="size-5" />Kontrol operasional</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-3"><Info title="Manajemen karyawan" text="Akun staff, role, permission, dan shift sekarang tersedia di Pegawai & Shift." /><Info title="Inventory" text="Stock alert, adjustment, purchase order, dan riwayat stok disiapkan sebagai modul berikutnya." /><Info title="QR Ordering" text="QR meja membuka menu pelanggan langsung tanpa aplikasi tambahan." /></div></CardContent></Card>
    </div>
  </AppShell>;
}
function PaymentRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) { return <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function Info({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><p className="font-medium text-sm">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>; }
function Stat({ icon: Icon, label, value, note }: { icon: typeof Store; label: string; value: string; note: string }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{note}</p></div></CardContent></Card>; }
