import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus, Pencil, Play, Square, ShieldCheck, Users, Clock, Activity, Mail } from "lucide-react";
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

const PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" }, { key: "orders", label: "Kasir & Pesanan" }, { key: "payments", label: "Pembayaran" }, { key: "products", label: "Produk" }, { key: "inventory", label: "Inventory" }, { key: "tables", label: "Meja & QR" }, { key: "reports", label: "Laporan" }, { key: "customers", label: "Pelanggan" }, { key: "promotions", label: "Promosi" }, { key: "settings", label: "Pengaturan" },
];
type Form = { user_id?: string; full_name: string; email: string; role: "manager" | "cashier"; is_active: boolean; permissions: Record<string, boolean> };
const DEFAULT_PERMISSIONS = { dashboard: true, orders: true, payments: true, products: false, inventory: false, tables: true, reports: false, customers: false, promotions: false, settings: false };

function PegawaiPage() {
  const qc = useQueryClient();
  const me = useStaffProfile();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>({ full_name: "", email: "", role: "cashier", is_active: true, permissions: { ...DEFAULT_PERMISSIONS } });
  const staffQuery = useQuery({ queryKey: ["staff-profiles"], queryFn: async () => { const { data, error } = await supabase.from("staff_profiles").select("*").order("created_at"); if (error) throw error; return (data ?? []) as StaffProfile[]; }, enabled: me.data?.role === "owner" });
  const shiftsQuery = useQuery({ queryKey: ["staff-shifts"], queryFn: async () => { const { data, error } = await supabase.from("staff_shifts").select("*").eq("status", "open").order("opened_at", { ascending: false }); if (error) throw error; return data ?? []; }, enabled: me.data?.role === "owner" });
  const staff = staffQuery.data ?? [];
  const activeStaff = staff.filter((s) => s.is_active);
  const activeShifts = shiftsQuery.data ?? [];

  function openNew() { setForm({ full_name: "", email: "", role: "cashier", is_active: true, permissions: { ...DEFAULT_PERMISSIONS } }); setOpen(true); }
  function openEdit(s: StaffProfile) { setForm({ user_id: s.user_id, full_name: s.full_name, email: "", role: s.role === "manager" ? "manager" : "cashier", is_active: s.is_active, permissions: { ...DEFAULT_PERMISSIONS, ...s.permissions } }); setOpen(true); }
  const save = useMutation({ mutationFn: async () => {
    if (!form.user_id) {
      const { data, error } = await supabase.functions.invoke("invite-staff", { body: { email: form.email, full_name: form.full_name, role: form.role, permissions: form.permissions, redirect_to: `${window.location.origin}/auth` } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Gagal mengirim undangan staff");
    } else {
      const { error } = await supabase.from("staff_profiles").update({ full_name: form.full_name, role: form.role, is_active: form.is_active, permissions: form.permissions }).eq("user_id", form.user_id);
      if (error) throw error;
    }
  }, onSuccess: () => { setOpen(false); void qc.invalidateQueries({ queryKey: ["staff-profiles"] }); toast.success(form.user_id ? "Akun staff diperbarui" : "Undangan staff dikirim ke email"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan staff") });
  const toggle = useMutation({ mutationFn: async ({ user_id, value }: { user_id: string; value: boolean }) => { const { error } = await supabase.from("staff_profiles").update({ is_active: value }).eq("user_id", user_id); if (error) throw error; }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff-profiles"] }); toast.success("Status akses diperbarui"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengubah akses") });
  const shift = useMutation({ mutationFn: async ({ staff_user_id, opening }: { staff_user_id: string; opening: boolean }) => { if (opening) { const { error } = await supabase.from("staff_shifts").insert({ owner_id: me.data!.owner_id, staff_user_id, opening_cash: 0, status: "open" }); if (error) throw error; } else { const { error } = await supabase.from("staff_shifts").update({ status: "closed", closed_at: new Date().toISOString() }).eq("staff_user_id", staff_user_id).eq("status", "open"); if (error) throw error; } }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["staff-shifts"] }); toast.success("Shift diperbarui"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengubah shift") });

  if (me.isLoading) return <AppShell title="Pegawai & Shift" description="Kelola akun staff, role, akses fitur, dan shift"><Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Memuat akses owner…</CardContent></Card></AppShell>;
  if (me.isError) return <AppShell title="Pegawai & Shift" description="Kelola akun staff, role, akses fitur, dan shift"><Card><CardContent className="py-12 text-center"><p className="font-medium">Akses staff gagal dimuat</p><p className="mt-2 text-sm text-muted-foreground">{me.error instanceof Error ? me.error.message : "Coba refresh halaman."}</p></CardContent></Card></AppShell>;
  if (me.data && me.data.role !== "owner") return <AppShell title="Pegawai & Shift" description="Akses ini hanya tersedia untuk owner"><Card><CardContent className="py-16 text-center"><ShieldCheck className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-4 font-semibold">Owner only</h2><p className="mt-1 text-sm text-muted-foreground">Hanya owner outlet yang dapat mengatur akun staff dan hak akses.</p></CardContent></Card></AppShell>;

  const shiftFor = (userId: string) => activeShifts.find((s) => s.staff_user_id === userId);
  const staffCount = useMemo(() => staff.length, [staff]);

  return <AppShell title="Pegawai & Shift" description="Kelola akun staff, role, akses fitur, dan shift" actions={<Button onClick={openNew}><UserPlus className="mr-2 size-4" />Tambah staff</Button>}>
    <div className="grid gap-4 md:grid-cols-4"><Stat icon={Users} label="Total pegawai" value={String(staffCount)} note={`${activeStaff.length} aktif`} /><Stat icon={Clock} label="Shift aktif" value={String(activeShifts.length)} note="Sedang bertugas" /><Stat icon={ShieldCheck} label="Role" value="3" note="Owner · Manager · Kasir" /><Stat icon={Activity} label="Kontrol akses" value="ON" note="RLS + permission" /></div>
    <Card className="mt-4"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Daftar akun staff</CardTitle><p className="mt-1 text-sm text-muted-foreground">Owner dapat mengaktifkan/nonaktifkan akses tanpa menghapus akun.</p></div><Button variant="outline" size="sm" onClick={() => staffQuery.refetch()}>Refresh</Button></CardHeader><CardContent className="p-0"><div className="divide-y">{staff.map((s) => { const currentShift = shiftFor(s.user_id); return <div key={s.user_id} className="flex flex-wrap items-center gap-4 p-4"><div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary font-semibold">{s.full_name.slice(0, 1).toUpperCase()}</div><div className="min-w-48 flex-1"><div className="flex items-center gap-2"><p className="font-medium">{s.full_name || "Tanpa nama"}</p><Badge variant={s.role === "owner" ? "default" : "secondary"}>{s.role}</Badge>{!s.is_active && <Badge variant="destructive">OFF</Badge>}</div><p className="text-xs text-muted-foreground">{s.user_id === me.data?.user_id ? "Akun owner ini" : "Akun staff"}</p></div><div className="hidden min-w-52 text-xs text-muted-foreground lg:block">{PERMISSIONS.filter((p) => s.role === "owner" || s.permissions?.[p.key]).map((p) => p.label).join(" · ")}</div><div className="flex items-center gap-2"><Switch checked={s.is_active} disabled={s.role === "owner"} onCheckedChange={(v) => toggle.mutate({ user_id: s.user_id, value: v })} /><span className="text-xs">{s.is_active ? "Akses ON" : "Akses OFF"}</span></div><Button variant="ghost" size="icon" onClick={() => openEdit(s)} disabled={s.role === "owner"}><Pencil className="size-4" /></Button><Button variant="outline" size="sm" onClick={() => shift.mutate({ staff_user_id: s.user_id, opening: !currentShift })} disabled={!s.is_active || s.role === "owner"}>{currentShift ? <><Square className="mr-2 size-4" />Tutup shift</> : <><Play className="mr-2 size-4" />Buka shift</>}</Button></div>; })}</div></CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{form.user_id ? "Edit akses staff" : "Tambah akun staff"}</DialogTitle><DialogDescription>{form.user_id ? "Atur role dan akses fitur akun ini." : "Staff akan menerima email undangan untuk membuat password sendiri."}</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (!form.user_id && !form.email.includes("@")) return toast.error("Email staff wajib valid"); save.mutate(); }}>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Nama staff</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>{!form.user_id && <div className="space-y-2"><Label>Email login</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="staff@cafe.com" required /></div>}</div>
      <div className="space-y-2"><Label>Role</Label><Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "manager" | "cashier" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cashier">Kasir</SelectItem><SelectItem value="manager">Manager</SelectItem></SelectContent></Select></div>
      <div><div className="mb-2 flex items-center justify-between"><div><p className="font-medium">Hak akses</p><p className="text-xs text-muted-foreground">Owner bisa ON/OFF per fitur.</p></div><Badge variant="outline">RLS aktif</Badge></div><div className="grid gap-2 sm:grid-cols-2">{PERMISSIONS.map((p) => <div key={p.key} className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm">{p.label}</span><Switch checked={form.permissions[p.key] === true} onCheckedChange={(v) => setForm({ ...form, permissions: { ...form.permissions, [p.key]: v })} /></div>)}</div></div>
      {form.user_id && <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="text-sm font-medium">Akun aktif</p><p className="text-xs text-muted-foreground">Matikan untuk memblokir akses staff.</p></div><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /></div>}
      <Button className="w-full" disabled={save.isPending}>{save.isPending ? "Menyimpan…" : form.user_id ? "Simpan perubahan" : <><Mail className="mr-2 size-4" />Kirim undangan staff</>}</Button>
    </form></DialogContent></Dialog>
  </AppShell>;
}
function Stat({ icon: Icon, label, value, note }: { icon: typeof Users; label: string; value: string; note: string }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{note}</p></div></CardContent></Card>; }
