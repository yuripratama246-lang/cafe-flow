import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, LockKeyhole, Play, RefreshCw, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useStaffProfile } from "@/lib/access";
import { fetchOrders } from "@/lib/pos";
import { endOfDayISO, rupiah, startOfDayISO, toDateInput } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/shift-kasir")({ component: CashShiftPage });

function CashShiftPage() {
  const qc = useQueryClient(); const me = useStaffProfile();
  const [openingCash, setOpeningCash] = useState(""); const [closingCash, setClosingCash] = useState("");
  const [cashExpense, setCashExpense] = useState(""); const [expenseReason, setExpenseReason] = useState("");
  const [note, setNote] = useState(""); const [closeNote, setCloseNote] = useState("");
  const shiftsQuery = useQuery({ queryKey: ["cash-shifts", me.data?.owner_id], enabled: !!me.data?.owner_id, queryFn: async () => {
    const { data, error } = await supabase.from("staff_shifts").select("*").eq("owner_id", me.data!.owner_id).order("opened_at", { ascending: false }).limit(50);
    if (error) throw error; return data ?? [];
  }, refetchInterval: 30000 });
  const shifts = shiftsQuery.data ?? []; const activeShift = shifts.find((s) => s.staff_user_id === me.data?.user_id && s.status === "open");
  // Match Dashboard's selected-day payment aggregation: same local-day boundaries,
  // paid/non-cancelled orders, and cash amounts from payments(method, amount).
  const dashboardDate = toDateInput(new Date());
  const dashboardFrom = startOfDayISO(dashboardDate);
  const dashboardTo = endOfDayISO(dashboardDate);
  const orderQuery = useQuery({
    queryKey: ["shift-dashboard-cash-sales", dashboardDate],
    queryFn: () => fetchOrders({ from: dashboardFrom, to: dashboardTo, limit: 300 }),
    refetchInterval: 15000,
  });
  const cashSales = useMemo(() => (orderQuery.data ?? [])
    .filter((o) => o.status !== "cancelled" && o.is_paid)
    .reduce((sum, order) => sum + (order.payments ?? [])
      .filter((payment) => payment.method === "cash")
      .reduce((n, payment) => n + Number(payment.amount || 0), 0), 0),
  [orderQuery.data]);
  const expenseAmount = cashExpense.trim() === "" ? 0 : Number(cashExpense);
  const expectedCash = Number(activeShift?.opening_cash ?? 0) + cashSales - expenseAmount;
  const difference = closingCash.trim() === "" ? null : Number(closingCash) - expectedCash;
  const openShift = useMutation({ mutationFn: async () => {
    if (!me.data) throw new Error("Profil kasir belum siap."); const amount = Number(openingCash);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Masukkan modal awal yang valid.");
    const { error } = await supabase.from("staff_shifts").insert({ owner_id: me.data.owner_id, staff_user_id: me.data.user_id, opening_cash: amount, note: note.trim() || null, status: "open" });
    if (error) throw error;
  }, onSuccess: async () => { setOpeningCash(""); setNote(""); await qc.invalidateQueries({ queryKey: ["cash-shifts"] }); await qc.invalidateQueries({ queryKey: ["staff-shifts"] }); toast.success("Shift berhasil dibuka."); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuka shift.") });
  const closeShift = useMutation({ mutationFn: async () => {
    if (!activeShift) throw new Error("Tidak ada shift aktif."); const actual = Number(closingCash);
    if (!Number.isFinite(actual) || actual < 0 || closingCash.trim() === "") throw new Error("Masukkan jumlah kas akhir yang valid.");
    if (!Number.isFinite(expenseAmount) || expenseAmount < 0) throw new Error("Masukkan nominal pengeluaran yang valid.");
    if (expenseAmount > 0 && !expenseReason.trim()) throw new Error("Isi alasan pengeluaran tunai.");
    if (difference !== 0) throw new Error("Kas belum cocok. Periksa penjualan tunai Dashboard dan input setiap pengeluaran beserta alasannya sampai selisih Rp0.");
    const { error } = await supabase.from("staff_shifts").update({ closing_cash: actual, closed_at: new Date().toISOString(), status: "closed", note: [activeShift.note, cashExpense.trim() ? `Pengeluaran tunai: Rp${expenseAmount} (${expenseReason.trim() || "tanpa keterangan"})` : "", closeNote.trim()].filter(Boolean).join(" | ") || null }).eq("id", activeShift.id).eq("status", "open");
    if (error) throw error;
  }, onSuccess: async () => { setClosingCash(""); setCashExpense(""); setExpenseReason(""); setCloseNote(""); await qc.invalidateQueries({ queryKey: ["cash-shifts"] }); await qc.invalidateQueries({ queryKey: ["staff-shifts"] }); toast.success("Shift ditutup dan kas akhir tersimpan."); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menutup shift.") });

  return <AppShell title="Opening & Closing Kasir" description="Catat modal awal, hitung kas yang diharapkan, dan rekonsiliasi kas akhir">
    <div className="mx-auto max-w-5xl space-y-5"><div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><div className="flex items-center gap-2"><Play className="size-4 text-emerald-500" /><CardTitle className="text-base">Opening — Buka Shift</CardTitle></div><p className="text-sm text-muted-foreground">Penjualan tunai mengikuti angka Pembayaran → Tunai di Dashboard untuk hari ini. Masukkan uang fisik awal di laci.</p></CardHeader><CardContent className="space-y-3">
        <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Penjualan tunai Dashboard hari ini</p><p className="num mt-1 text-lg font-semibold">{orderQuery.isLoading ? "Memuat…" : rupiah(cashSales)}</p></div>
        <div className="space-y-1.5"><Label>Modal awal (Rp)</Label><Input type="number" min="0" inputMode="numeric" placeholder="Contoh: 200000" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} disabled={!!activeShift} /></div>
        <div className="space-y-1.5"><Label>Catatan opening (opsional)</Label><Textarea rows={2} placeholder="Contoh: uang pecahan untuk kembalian" value={note} onChange={(e) => setNote(e.target.value)} disabled={!!activeShift} /></div>
        <Button className="w-full" disabled={!!activeShift || openShift.isPending || !openingCash.trim()} onClick={() => openShift.mutate()}><Play className="mr-2 size-4" />{openShift.isPending ? "Membuka shift…" : "Buka Shift"}</Button>
        {activeShift && <p className="text-xs text-amber-600">Masih ada shift aktif. Tutup shift tersebut sebelum membuka shift baru.</p>}
      </CardContent></Card>
      <Card><CardHeader><div className="flex items-center gap-2"><LockKeyhole className="size-4 text-sky-500" /><CardTitle className="text-base">Closing — Tutup Shift</CardTitle></div><p className="text-sm text-muted-foreground">Penjualan tunai memakai sumber dan periode yang sama dengan Dashboard hari ini. Catat pengeluaran, lalu hitung kas fisik.</p></CardHeader><CardContent className="space-y-3">
        {activeShift ? <><div className="grid grid-cols-2 gap-3"><Metric label="Modal awal" value={rupiah(activeShift.opening_cash)} /><Metric label="Penjualan tunai" value={orderQuery.isLoading ? "Memuat…" : rupiah(cashSales)} /><Metric label="Pengeluaran tunai" value={rupiah(expenseAmount)} /><Metric label="Kas seharusnya setelah pengeluaran" value={orderQuery.isLoading ? "Memuat…" : rupiah(expectedCash)} /><Metric label="Selisih sementara" value={difference === null ? "—" : rupiah(difference)} /></div>
          <div className="space-y-1.5"><Label>Pengeluaran tunai selama shift (Rp)</Label><Input type="number" min="0" inputMode="numeric" placeholder="Contoh: 100000 untuk beli gas" value={cashExpense} onChange={(e) => setCashExpense(e.target.value)} /><Input aria-label="Keperluan pengeluaran tunai" placeholder="Keperluan: beli gas, belanja, dll." value={expenseReason} onChange={(e) => setExpenseReason(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Kas akhir aktual (Rp)</Label><Input type="number" min="0" inputMode="numeric" placeholder="Hitung uang fisik di laci" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} /></div>
          <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Kas seharusnya = modal awal + penjualan tunai Dashboard hari ini − pengeluaran tunai. Selisih = kas aktual − kas seharusnya.</p><p className={`num mt-1 text-xl font-bold ${difference === null ? "" : difference === 0 ? "text-emerald-500" : "text-amber-500"}`}>{difference === null ? "Isi kas akhir untuk melihat selisih" : difference === 0 ? "Seimbang · Rp0" : rupiah(difference)}</p></div>
          <div className="space-y-1.5"><Label>Catatan closing (opsional)</Label><Textarea rows={2} placeholder="Catatan selisih / kejadian selama shift" value={closeNote} onChange={(e) => setCloseNote(e.target.value)} /></div>
          <p className={`text-xs ${difference === 0 ? "text-emerald-600" : "text-amber-600"}`}>{closingCash.trim() === "" ? "Isi kas fisik untuk memeriksa kecocokan." : difference === 0 ? "Kas cocok. Closing dapat dilakukan." : `Belum cocok: ${rupiah(Math.abs(difference ?? 0))} ${difference !== null && difference < 0 ? "kurang" : "lebih"}. Jika ada uang keluar, catat nominal dan alasannya; closing hanya aktif saat selisih Rp0.`}</p>
          <Button variant="destructive" className="w-full" disabled={closeShift.isPending || closingCash.trim() === "" || orderQuery.isLoading || difference !== 0 || (expenseAmount > 0 && !expenseReason.trim())} onClick={() => closeShift.mutate()}><LockKeyhole className="mr-2 size-4" />{closeShift.isPending ? "Menyimpan closing…" : "Tutup Shift & Simpan Kas"}</Button>
        </> : <div className="rounded-xl border border-dashed p-8 text-center"><WalletCards className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="font-medium">Belum ada shift aktif</p><p className="mt-1 text-sm text-muted-foreground">Buka shift dan input modal awal untuk mulai mencatat kas.</p></div>}
      </CardContent></Card></div>
      <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Riwayat Shift</CardTitle><p className="mt-1 text-xs text-muted-foreground">Opening, closing, dan rekonsiliasi kas terbaru</p></div><Button size="sm" variant="outline" onClick={() => shiftsQuery.refetch()}><RefreshCw className="mr-2 size-3.5" />Refresh</Button></CardHeader><CardContent>
        {shiftsQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Memuat riwayat…</p> : shifts.length ? <div className="space-y-3">{shifts.map((s) => { const cashMovement = s.closing_cash === null ? null : Number(s.closing_cash) - Number(s.opening_cash); return <div key={s.id} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{s.staff_user_id === me.data?.user_id ? "Shift saya" : "Shift staff"}</p><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? "Sedang berjalan" : "Selesai"}</Badge></div><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{new Date(s.opened_at).toLocaleString("id-ID")} {s.closed_at ? `— ${new Date(s.closed_at).toLocaleString("id-ID")}` : ""}</p>{s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}</div><div className="grid grid-cols-2 gap-x-5 gap-y-1 text-right text-xs sm:min-w-64"><span className="text-muted-foreground">Modal awal</span><b className="num">{rupiah(s.opening_cash)}</b><span className="text-muted-foreground">Kas akhir</span><b className="num">{s.closing_cash === null ? "—" : rupiah(s.closing_cash)}</b><span className="text-muted-foreground">Perubahan kas*</span><b className={`num ${cashMovement === null ? "" : cashMovement === 0 ? "text-emerald-500" : "text-amber-500"}`}>{cashMovement === null ? "—" : rupiah(cashMovement)}</b></div></div>; })}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Belum ada riwayat shift.</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">*Perubahan kas adalah kas akhir dikurangi modal awal. Kas seharusnya saat closing = modal awal + penjualan tunai − pengeluaran tunai yang diinput saat closing.</p>
      </CardContent></Card>
    </div>
  </AppShell>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-muted/30 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="num mt-1 text-sm font-semibold">{value}</p></div>; }
