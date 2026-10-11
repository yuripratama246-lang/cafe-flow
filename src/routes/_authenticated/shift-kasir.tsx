import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, LockKeyhole, Play, RefreshCw, Wallet, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useStaffProfile } from "@/lib/access";
import { fetchOrders } from "@/lib/pos";
import { rupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/shift-kasir")({ component: CashShiftPage });

function CashShiftPage() {
  const qc = useQueryClient();
  const me = useStaffProfile();
  const [openingCash, setOpeningCash] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [cashExpense, setCashExpense] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [closingReason, setClosingReason] = useState("");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const shiftsQuery = useQuery({
    queryKey: ["cash-shifts", me.data?.owner_id],
    enabled: !!me.data?.owner_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_shifts").select("*")
        .eq("owner_id", me.data!.owner_id).order("opened_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 10000,
  });
  const shifts = shiftsQuery.data ?? [];
  const activeShift = shifts.find((s) => s.staff_user_id === me.data?.user_id && s.status === "open");
  const startedAt = activeShift?.opened_at ?? null;

  const ordersQuery = useQuery({
    queryKey: ["shift-cash-sales", activeShift?.id, startedAt],
    enabled: !!activeShift && !!startedAt,
    queryFn: () => fetchOrders({ from: startedAt ?? undefined, to: new Date().toISOString(), limit: 5000 }),
    refetchInterval: 10000,
  });
  const cashSales = useMemo(() => (ordersQuery.data ?? [])
    .filter((order) => order.created_at >= (startedAt ?? "") && order.status !== "cancelled" && order.is_paid)
    .reduce((sum, order) => sum + (order.payments ?? [])
      .filter((payment) => payment.method === "cash")
      .reduce((n, payment) => n + Number(payment.amount || 0), 0), 0),
  [ordersQuery.data, startedAt]);

  const openingAmount = Number(activeShift?.opening_cash ?? 0);
  const expenseAmount = cashExpense.trim() ? Number(cashExpense) : 0;
  const expectedCash = openingAmount + cashSales - expenseAmount;
  const countedCash = closingCash.trim() === "" ? null : Number(closingCash);
  const difference = countedCash === null ? null : countedCash - expectedCash;
  const hasValidExpense = Number.isFinite(expenseAmount) && expenseAmount >= 0 && (expenseAmount === 0 || !!expenseReason.trim());
  const canReview = countedCash !== null && Number.isFinite(countedCash) && countedCash >= 0 &&
    hasValidExpense && (difference === 0 || !!closingReason.trim()) && !ordersQuery.isLoading;

  const openShift = useMutation({
    mutationFn: async () => {
      if (!me.data) throw new Error("Profil kasir belum siap.");
      const amount = Number(openingCash);
      if (!openingCash.trim() || !Number.isFinite(amount) || amount < 0) throw new Error("Masukkan modal awal yang valid.");
      const { error } = await supabase.from("staff_shifts").insert({
        owner_id: me.data.owner_id, staff_user_id: me.data.user_id,
        opening_cash: amount, note: openingNote.trim() || null, status: "open",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setOpeningCash(""); setOpeningNote("");
      await qc.invalidateQueries({ queryKey: ["cash-shifts"] });
      await qc.invalidateQueries({ queryKey: ["staff-shifts"] });
      toast.success("Shift berhasil dibuka. Selamat bertugas!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuka shift."),
  });

  const closeShift = useMutation({
    mutationFn: async () => {
      if (!activeShift) throw new Error("Tidak ada shift aktif.");
      if (countedCash === null || !Number.isFinite(countedCash) || countedCash < 0) throw new Error("Masukkan kas fisik yang valid.");
      if (!hasValidExpense) throw new Error(expenseAmount > 0 ? "Isi alasan pengeluaran kas." : "Nominal pengeluaran tidak valid.");
      if (difference !== 0 && !closingReason.trim()) throw new Error("Catat penyebab selisih kas.");
      const details = [
        activeShift.note,
        expenseAmount > 0 ? `Pengeluaran tunai: Rp${expenseAmount} (${expenseReason.trim()})` : "",
        `Rekonsiliasi: kas seharusnya Rp${expectedCash}; kas fisik Rp${countedCash}; selisih Rp${difference}`,
        closingReason.trim() ? `Penyebab/catatan closing: ${closingReason.trim()}` : "",
      ].filter(Boolean).join(" | ");
      const { data, error } = await supabase.from("staff_shifts").update({
        closing_cash: countedCash, closed_at: new Date().toISOString(), closed_by_user_id: me.data?.user_id ?? null, status: "closed", note: details || null,
      }).eq("id", activeShift.id).eq("status", "open").select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Shift tidak berubah. Muat ulang halaman dan periksa status shift.");
    },
    onSuccess: async () => {
      setClosingCash(""); setCashExpense(""); setExpenseReason(""); setClosingReason(""); setCloseDialogOpen(false);
      await qc.invalidateQueries({ queryKey: ["cash-shifts"] });
      await qc.invalidateQueries({ queryKey: ["staff-shifts"] });
      toast.success("Shift berhasil ditutup. Laporan tersimpan di riwayat shift.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menutup shift."),
  });

  return <AppShell title="Buka & Tutup Shift" description="Kelola modal awal dan rekonsiliasi uang fisik kasir">
    <div className="mx-auto max-w-6xl space-y-5">
      {!activeShift ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex items-center gap-2"><Play className="size-5 text-emerald-600" /><CardTitle>Buka shift kasir</CardTitle></div>
              <p className="text-sm text-muted-foreground">Hitung uang fisik di laci sebelum mulai melayani pesanan.</p>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-sm font-medium">Status outlet</p>
                <p className="mt-1 text-lg font-semibold">Siap dibuka</p>
                <p className="mt-1 text-sm text-muted-foreground">Masukkan modal awal kas untuk mengaktifkan shift.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-cash">Modal awal kas (Rp)</Label>
                <Input id="opening-cash" type="number" min="0" inputMode="numeric" placeholder="Contoh: 200000" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
                <p className="text-xs text-muted-foreground">Uang fisik yang benar-benar tersedia di laci saat shift dimulai.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-note">Catatan opening (opsional)</Label>
                <Textarea id="opening-note" rows={2} placeholder="Contoh: uang pecahan untuk kembalian" value={openingNote} onChange={(e) => setOpeningNote(e.target.value)} />
              </div>
              <Button className="w-full" disabled={!openingCash.trim() || openShift.isPending} onClick={() => openShift.mutate()}>
                <Play className="mr-2 size-4" />{openShift.isPending ? "Membuka shift…" : "Buka Shift"}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Sebelum mulai</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <InfoRow icon={<Wallet className="size-4" />} title="Hitung uang fisik" text="Pastikan modal awal sama dengan uang yang benar-benar ada di laci." />
              <InfoRow icon={<Clock3 className="size-4" />} title="Periode shift dimulai" text="Penjualan tunai dihitung sejak tombol Buka Shift berhasil digunakan." />
              <InfoRow icon={<CheckCircle2 className="size-4" />} title="Pembayaran non-tunai" text="QRIS dan transfer tidak menambah kas fisik di laci." />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_.85fr]">
          <div className="space-y-5">
            <Card className="border-emerald-500/30">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-5" /></span>
                  <div><p className="font-semibold">Shift aktif</p><p className="text-sm text-muted-foreground">Mulai {new Date(activeShift.opened_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</p></div>
                </div>
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">AKTIF</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Rekonsiliasi kas</CardTitle><p className="text-sm text-muted-foreground">Hitung uang fisik di laci sebelum menutup shift.</p></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Modal awal" value={rupiah(openingAmount)} />
                  <Metric label="Penjualan tunai lunas" value={ordersQuery.isLoading ? "Memuat…" : rupiah(cashSales)} />
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">Kas seharusnya di laci</p>
                  <p className="num mt-1 text-2xl font-bold">{ordersQuery.isLoading ? "Memuat…" : rupiah(expectedCash)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Modal awal + transaksi tunai lunas − pengeluaran kas yang dicatat. QRIS dan transfer tidak termasuk.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cash-expense">Pengeluaran kas selama shift (Rp)</Label>
                  <Input id="cash-expense" type="number" min="0" inputMode="numeric" placeholder="0" value={cashExpense} onChange={(e) => setCashExpense(e.target.value)} />
                  <Input aria-label="Alasan pengeluaran kas" placeholder="Keperluan, misalnya beli gas" value={expenseReason} onChange={(e) => setExpenseReason(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="closing-cash">Uang fisik hasil hitung (Rp)</Label>
                  <Input id="closing-cash" type="number" min="0" inputMode="numeric" placeholder="Hitung semua uang di laci" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
                </div>
                {difference !== null && Number.isFinite(difference) && (
                  <div className={`rounded-xl border p-4 ${difference === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                    <p className="text-sm font-medium">{difference === 0 ? "Selisih kas · Cocok" : `Selisih kas · ${difference < 0 ? "Kas kurang" : "Kas lebih"}`}</p>
                    <p className={`num mt-1 text-2xl font-bold ${difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>{rupiah(difference)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{difference === 0 ? "Uang fisik sesuai catatan sistem." : `Kas ${difference < 0 ? "kurang" : "lebih"} ${rupiah(Math.abs(difference))}. Catat penyebabnya sebelum tutup shift.`}</p>
                  </div>
                )}
                {difference !== null && difference !== 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="closing-reason">Penyebab selisih kas (wajib)</Label>
                    <Textarea id="closing-reason" rows={2} placeholder="Contoh: tidak ada uang kembalian" value={closingReason} onChange={(e) => setClosingReason(e.target.value)} />
                  </div>
                )}
                <Button className="w-full" disabled={!canReview} onClick={() => setCloseDialogOpen(true)}>
                  <LockKeyhole className="mr-2 size-4" />Review dan Tutup Shift
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-5 lg:sticky lg:top-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Ringkasan shift berjalan</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow label="Status" value="Masih terbuka" green />
                <SummaryRow label="Waktu mulai" value={new Date(activeShift.opened_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} />
                <SummaryRow label="Modal awal" value={rupiah(openingAmount)} />
                <SummaryRow label="Penjualan tunai" value={ordersQuery.isLoading ? "Memuat…" : rupiah(cashSales)} />
                <SummaryRow label="Pengeluaran kas" value={rupiah(expenseAmount)} />
                <div className="border-t pt-3"><SummaryRow label="Kas seharusnya" value={ordersQuery.isLoading ? "Memuat…" : rupiah(expectedCash)} strong /></div>
                <p className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">Pengeluaran atau penambahan uang yang tidak dicatat sebagai transaksi perlu dicatat manual agar rekonsiliasi akurat.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Riwayat shift</CardTitle><Button size="icon" variant="ghost" aria-label="Refresh riwayat shift" onClick={() => shiftsQuery.refetch()}><RefreshCw className="size-4" /></Button></CardHeader>
              <CardContent className="space-y-3">
                {shiftsQuery.isLoading ? <p className="text-sm text-muted-foreground">Memuat riwayat…</p> : shifts.filter((s) => s.status === "closed").slice(0, 5).length ? shifts.filter((s) => s.status === "closed").slice(0, 5).map((s) => (
                  <div key={s.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{new Date(s.opened_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</p><Badge variant="secondary">Selesai</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(s.opened_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}{s.closed_at ? ` – ${new Date(s.closed_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                    <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">Kas akhir</span><b>{s.closing_cash == null ? "—" : rupiah(s.closing_cash)}</b></div>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Belum ada shift yang ditutup.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Konfirmasi tutup shift</DialogTitle><DialogDescription>Periksa kembali hitungan kas sebelum menyimpan laporan penutupan.</DialogDescription></DialogHeader>
        <div className="space-y-3 rounded-xl border p-4 text-sm">
          <SummaryRow label="Kas seharusnya" value={rupiah(expectedCash)} />
          <SummaryRow label="Kas fisik dihitung" value={countedCash === null ? "—" : rupiah(countedCash)} />
          <SummaryRow label="Selisih kas" value={difference === null ? "—" : rupiah(difference)} strong />
          {difference !== 0 && <div className="rounded-lg bg-amber-500/10 p-3"><p className="font-medium">Penyebab selisih</p><p className="mt-1 text-muted-foreground">{closingReason}</p></div>}
          {expenseAmount > 0 && <div className="text-muted-foreground">Pengeluaran: {rupiah(expenseAmount)} · {expenseReason}</div>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Periksa lagi</Button><Button variant="destructive" disabled={closeShift.isPending} onClick={() => closeShift.mutate()}><LockKeyhole className="mr-2 size-4" />{closeShift.isPending ? "Menyimpan…" : "Ya, Tutup Shift"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </AppShell>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="num mt-1 text-lg font-semibold">{value}</p></div>;
}
function SummaryRow({ label, value, green = false, strong = false }: { label: string; value: string; green?: boolean; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className={`text-right ${green ? "font-medium text-emerald-600" : ""} ${strong ? "font-bold" : "font-medium"}`}>{value}</span></div>;
}
function InfoRow({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 text-muted-foreground">{icon}</span><div><p className="font-medium">{title}</p><p className="mt-1 text-muted-foreground">{text}</p></div></div>;
}
