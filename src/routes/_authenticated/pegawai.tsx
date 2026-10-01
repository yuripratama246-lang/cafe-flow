import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Pencil, Play, Square, ShieldCheck, Users, Clock, Activity, Mail, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useStaffProfile, type StaffProfile, type PermissionKey } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/pegawai")({ component: PegawaiPage });

const PERMISSION_GROUPS = [
  { title: "Operasional Kasir", items: [
    { key: "pos.create_order", label: "Buat Pesanan", description: "Membuat transaksi dan menambahkan item pesanan." },
    { key: "pos.manual_discount", label: "Diskon Manual", description: "Memberikan diskon di luar promo otomatis." },
    { key: "pos.void_transaction", label: "Void / Batal Transaksi", description: "Membatalkan transaksi yang sudah dibuat." },
    { key: "pos.open_drawer", label: "Buka Cash Drawer Tanpa Transaksi", description: "Membuka laci kas tanpa menyelesaikan penjualan." },
    { key: "shift.manage", label: "Buka / Tutup Shift", description: "Memulai dan mengakhiri shift kasir." },
    { key: "shift.view_cash", label: "Lihat Ringkasan Uang Laci", description: "Melihat saldo awal, uang masuk, dan hasil hitung laci." },
  ]},
  { title: "Inventori & Gudang", items: [
    { key: "inventory.view_stock", label: "Lihat Stok", description: "Melihat jumlah stok dan pergerakan persediaan." },
    { key: "inventory.adjust_stock", label: "Stock Adjustment / Koreksi Stok", description: "Mengubah stok secara manual dengan alasan koreksi." },
    { key: "inventory.purchase_order", label: "Input Purchase Order / Supplier", description: "Mencatat pembelian stok dan data pemasok." },
  ]},
  { title: "Keuangan & Laporan", items: [
    { key: "report.view", label: "Lihat Laporan", description: "Mengakses ringkasan penjualan dan laporan operasional." },
    { key: "report.export", label: "Ekspor Data Excel / CSV", description: "Mengunduh data laporan untuk digunakan di luar aplikasi." },
  ]},
] as const;
const GRANULAR_DEFAULTS: Record<string, boolean> = {
  "pos.create_order": true, "pos.manual_discount": false, "pos.void_transaction": false, "pos.open_drawer": false,
  "shift.manage": true, "shift.view_cash": false,
  "inventory.view_stock": false, "inventory.adjust_stock": false, "inventory.purchase_order": false,
  "report.view": false, "report.export": false,
};
const LEGACY_DEFAULTS = { dashboard: true, orders: true, payments: true, products: false, inventory: false, tables: true, reports: false, customers: false, promotions: false, settings: false };
const PERMISSIONS = [{key:"orders",label:"Pesanan"},{key:"payments",label:"Pembayaran"},{key:"inventory",label:"Inventory"},{key:"reports",label:"Laporan"}] as const;

type Form = { user_id?: string; full_name: string; email: string; role: "manager" | "cashier"; is_active: boolean; permissions: Record<string, boolean> };
const DEFAULT_PERMISSIONS = { ...LEGACY_DEFAULTS, ...GRANULAR_DEFAULTS };
function buildPermissionsPayload(permissions: Record<string, boolean>) {
  return {
    ...permissions,
    orders: permissions["pos.create_order"] === true,
    payments: permissions["pos.manual_discount"] === true || permissions["pos.void_transaction"] === true,
    inventory: permissions["inventory.view_stock"] === true || permissions["inventory.adjust_stock"] === true || permissions["inventory.purchase_order"] === true,
    reports: permissions["report.view"] === true || permissions["report.export"] === true,
  };
}
const PRODUCTION_AUTH_URL = "https://pos.yuripratama246.workers.dev/auth?invite=1";

function PegawaiPage() {
  const qc = useQueryClient(); const me = useStaffProfile(); const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ full_name: "", email: "", role: "cashier", is_active: true, permissions: { ...DEFAULT_PERMISSIONS } });
  const staffQuery = useQuery({ queryKey: ["staff-profiles"], queryFn: async () => { const { data, error } = await supabase.from("staff_profiles").select("*").order("created_at"); if (error) throw error; return (data ?? []) as StaffProfile[]; }, enabled: me.data?.role === "owner" });
  const shiftsQuery = useQuery({ queryKey: ["staff-shifts"], queryFn: async () => { const { data, error } = await supabase.from("staff_shifts").select("*").eq("status", "open").order("opened_at", { ascending: false }); if (error) throw error; return data ?? []; }, enabled: me.data?.role === "owner" });
  const save = useMutation({ mutationFn: async () => { if (!form.user_id) { const { data, error } = await supabase.functions.invoke("invite-staff", { body: { email: form.email, full_name: form.full_name, role: form.role, permissions: buildPermissionsPayload(form.permissions), redirect_to: PRODUCTION_AUTH_URL } }); if (error) throw error; if (!data?.ok) throw new Error(data?.error ?? "Gagal mengirim undangan staff"); } else { const { error } = await supabase.from("staff_profiles").update({ full_name: form.full_name, role: form.role, is_active: form.is_active, permissions: buildPermissionsPayload(form.permissions) }).eq("user_id", form.user_id); if (error) throw error; } }, onSuccess: () => { setOpen(false); void qc.invalidateQueries({ queryKey: ["staff-profiles"] }); toast.success(form.user_id ? "Akun staff diperbarui" : "Undangan staff dikirim ke email"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan staff") });
  const toggle = useMutation({ mutationFn: async ({ user_id, value }: { user_id: string; value: boolean }) => { const { error } = await supabase.from("staff_profiles").update({ is_active: value }).eq("user_id", user_id); if (error) throw error; }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff-profiles"] }); toast.success("Status akses diperbarui"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengubah akses") });
  const deleteStaff = useMutation({ mutationFn: async (user_id: string) => { const { data, error } = await supabase.functions.invoke("delete-staff", { body: { user_id } }); if (error) throw error; if (!data?.ok) throw new Error(data?.error ?? "Gagal menghapus akun staff"); }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff-profiles"] }); void qc.invalidateQueries({ queryKey: ["staff-shifts"] }); toast.success("Akun staff berhasil dihapus"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menghapus akun staff") });
  const shift = useMutation({ mutationFn: async ({ staff_user_id, opening }: { staff_user_id: string; opening: boolean }) => { if (opening) { const { error } = await supabase.from("staff_shifts").insert({ owner_id: me.data!.owner_id, staff_user_id, opening_cash: 0, status: "open" }); if (error) throw error; } else { const { error } = await supabase.from("staff_shifts").update({ status: "closed", closed_at: new Date().toISOString() }).eq("staff_user_id", staff_user_id).eq("status", "open"); if (error) throw error; } }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff-shifts"] }); toast.success("Shift diperbarui"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengubah shift") });
  const staff = staffQuery.data ?? []; const activeStaff = staff.filter((s) => s.is_active); const activeShifts = shiftsQuery.data ?? []; const shiftFor = (userId: string) => activeShifts.find((s) => s.staff_user_id === userId);
  function openNew() { setForm({ full_name: "", email: "", role: "cashier", is_active: true, permissions: { ...DEFAULT_PERMISSIONS } }); setOpen(true); }
  function openEdit(s: StaffProfile) { setForm({ user_id: s.user_id, full_name: s.full_name, email: "", role: s.role === "manager" ? "manager" : "cashier", is_active: s.is_active, permissions: { ...DEFAULT_PERMISSIONS, ...s.permissions } }); setOpen(true); }
  function handleDelete(s: StaffProfile) { if (s.role === "owner") return; const confirmed = window.confirm(`Hapus akun ${s.full_name || "staff ini"}? Akun login, profil staff, dan data shift akun ini akan dihapus. Tindakan ini tidak dapat dibatalkan.`); if (confirmed) deleteStaff.mutate(s.user_id); }
  return <AppShell title="Pegawai & Shift" description="Kelola akun staff, izin akses, dan shift">
    <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Staff aktif</h2><p className="text-sm text-muted-foreground">{activeStaff.length} akun aktif</p></div><Button onClick={openNew}><UserPlus className="mr-2 size-4" />Tambah staff</Button></div>
      <div className="grid gap-3 md:grid-cols-2">{staff.map((s) => { const openShift = shiftFor(s.user_id); return <Card key={s.user_id}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{s.full_name}</CardTitle><p className="text-xs text-muted-foreground">{s.role === "manager" ? "Manager" : s.role === "owner" ? "Owner" : "Kasir"}</p></div><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Aktif" : "Nonaktif"}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2">{PERMISSIONS.filter((p) => s.role === "owner" || s.permissions?.[p.key]).slice(0, 6).map((p) => <Badge key={p.key} variant="outline">{p.label}</Badge>)}</div>{s.role !== "owner" && <div className="flex flex-wrap gap-2 border-t pt-3"><Button size="sm" variant="outline" onClick={() => openEdit(s)}><Pencil className="mr-1 size-3.5" />Edit</Button><Button size="sm" variant="outline" onClick={() => toggle.mutate({ user_id: s.user_id, value: !s.is_active })}>{s.is_active ? <><Square className="mr-1 size-3.5" />Nonaktifkan</> : <><Play className="mr-1 size-3.5" />Aktifkan</>}</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(s)}><Trash2 className="mr-1 size-3.5" />Hapus</Button>{openShift ? <Button size="sm" variant="outline" onClick={() => shift.mutate({ staff_user_id: s.user_id, opening: false })}><Clock className="mr-1 size-3.5" />Tutup shift</Button> : <Button size="sm" variant="outline" onClick={() => shift.mutate({ staff_user_id: s.user_id, opening: true })}><Play className="mr-1 size-3.5" />Buka shift</Button>}</div>}</CardContent></Card>; })}</div>
      {staff.length === 0 && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-3 size-8" />Belum ada staff.</CardContent></Card>}
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{form.user_id ? "Edit staff" : "Tambah staff"}</DialogTitle><DialogDescription>Atur role dan izin yang boleh digunakan staff.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Nama lengkap</Label><Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></div>{!form.user_id && <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="staff@email.com" /></div>}</div><div className="space-y-1.5"><Label>Role</Label><Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Form["role"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cashier">Kasir</SelectItem><SelectItem value="manager">Manager</SelectItem></SelectContent></Select></div><div className="space-y-4">{PERMISSION_GROUPS.map((group) => <section key={group.title} className="overflow-hidden rounded-xl border border-slate-800 bg-[#0D1116]/70"><div className="border-b border-slate-800 px-4 py-3"><h3 className="text-sm font-semibold text-slate-100">{group.title}</h3></div><div className="divide-y divide-slate-800/80">{group.items.map((permission) => <div key={permission.key} className="flex items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><p className="text-sm font-medium text-slate-100">{permission.label}</p><p className="mt-0.5 text-xs text-slate-400">{permission.description}</p></div><Switch checked={form.permissions[permission.key] === true} onCheckedChange={(v) => setForm((f) => ({ ...f, permissions: { ...f.permissions, [permission.key]: v } }))} /></div>)}</div></section>)}</div>{form.user_id && <div className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">Akun aktif</span><Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /></div>}<Button className="w-full bg-amber-500 text-black hover:bg-amber-400" disabled={save.isPending || !form.full_name.trim() || (!form.user_id && !form.email.trim())} onClick={() => save.mutate()}>{save.isPending ? "Menyimpan…" : form.user_id ? "Simpan perubahan" : <><Mail className="mr-2 size-4" />Kirim undangan</>}</Button></div></DialogContent></Dialog>
    </div>
  </AppShell>;
}
