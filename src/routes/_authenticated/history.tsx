import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, Trash2, Eye, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchOrders, PAYMENT_LABEL, STATUS_LABEL, type OrderWithItems } from "@/lib/pos";
import { rupiah, timeLabel } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });
function HistoryPage() {
  const qc = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrderWithItems | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmMode, setConfirmMode] = useState<"selected" | "reset" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const query = useQuery({ queryKey: ["orders", "history", "all"], queryFn: () => fetchOrders({ limit: 50000 }), refetchInterval: 30000 });
  const allOrders = query.data ?? [];
  const orders = useMemo(() => allOrders.filter((o) => {
    const day = o.created_at.slice(0, 10);
    const inRange = (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
    const term = search.trim().toLowerCase();
    const matches = !term || `${o.order_no} ${o.customer_name ?? ""} ${o.restaurant_tables?.name ?? ""}`.toLowerCase().includes(term);
    return inRange && matches;
  }), [allOrders, fromDate, toDate, search]);
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) throw new Error("Tidak ada transaksi yang dipilih.");
      const { data, error } = await supabase.from("orders").delete().in("id", ids).select("id");
      if (error) throw error;
      if ((data?.length ?? 0) !== ids.length) throw new Error("Sebagian transaksi tidak terhapus. Periksa hak akses owner dan muat ulang data.");
      return data.length;
    },
    onSuccess: (count) => { setSelectedIds([]); setConfirmMode(null); setConfirmText(""); setSelected(null); void qc.invalidateQueries({ queryKey: ["orders"] }); toast.success(`${count} transaksi berhasil dihapus.`); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menghapus transaksi."),
  });
  const visibleIds = orders.map(o => o.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const confirmationPhrase = confirmMode === "reset" ? "RESET SEMUA TRANSAKSI" : "HAPUS TRANSAKSI TERPILIH";
  const selectedCount = confirmMode === "reset" ? allOrders.length : selectedIds.length;
  function beginDelete(mode: "selected" | "reset") { setConfirmMode(mode); setConfirmText(""); }
  async function confirmDelete() {
    if (confirmText !== confirmationPhrase) return;
    const ids = confirmMode === "reset" ? allOrders.map(o => o.id) : selectedIds;
    deleteMutation.mutate(ids);
  }
  return <AppShell title="Transaksi" description="Semua transaksi, status pembayaran, dan riwayat order">
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{orders.length} transaksi ditampilkan · {selectedIds.length} dipilih</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={selectedIds.length === 0 || deleteMutation.isPending} onClick={() => beginDelete("selected")}><Trash2 className="mr-1.5 size-4" />Hapus Terpilih ({selectedIds.length})</Button>
          <Button size="sm" variant="destructive" disabled={allOrders.length === 0 || deleteMutation.isPending} onClick={() => beginDelete("reset")}><AlertTriangle className="mr-1.5 size-4" />Reset Semua Data</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
        <div><Label className="mb-1 block text-xs">Dari tanggal</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
        <div><Label className="mb-1 block text-xs">Sampai tanggal</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
        <div className="relative sm:col-span-2"><Label className="mb-1 block text-xs">Cari transaksi</Label><Search className="pointer-events-none absolute left-3 top-9 size-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nomor order, pelanggan, atau meja…" className="pl-9" /></div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-4"><Button size="sm" variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-1.5 size-4" />Refresh</Button><Button size="sm" variant="ghost" onClick={() => { setFromDate(""); setToDate(""); setSearch(""); setSelectedIds([]); }}>Reset filter</Button><span className="text-xs text-muted-foreground">Rentang tanggal berlaku untuk semua status transaksi.</span></div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground"><tr>
            <th className="w-9 px-3 py-3"><Checkbox checked={allVisibleSelected} onCheckedChange={v => setSelectedIds(v ? Array.from(new Set([...selectedIds, ...visibleIds])) : selectedIds.filter(id => !visibleIds.includes(id)))} aria-label="Pilih semua transaksi yang terlihat" /></th>
            <th className="px-3 py-3 font-semibold">Waktu</th><th className="px-3 py-3 font-semibold">Order</th><th className="px-3 py-3 font-semibold">Sumber</th><th className="px-3 py-3 text-right font-semibold">Total</th><th className="px-3 py-3 font-semibold">Metode</th><th className="px-3 py-3 text-right font-semibold">Dibayar</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Aksi</th>
          </tr></thead>
          <tbody className="divide-y">
            {query.isLoading ? <tr><td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">Memuat transaksi…</td></tr> : orders.length === 0 ? <tr><td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">Tidak ada transaksi untuk filter ini.</td></tr> : orders.map(o => {
              const rejected = o.payment_status === "rejected";
              const status = rejected ? "Ditolak" : o.status === "cancelled" ? "Dibatalkan" : o.is_paid ? "Lunas" : "Belum lunas";
              const paid = (o.payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
              return <tr key={o.id} className={selectedIds.includes(o.id) ? "bg-primary/5" : "hover:bg-muted/30"}>
                <td className="px-3 py-3"><Checkbox checked={selectedIds.includes(o.id)} onCheckedChange={v => setSelectedIds(old => v ? [...old, o.id] : old.filter(id => id !== o.id))} aria-label={`Pilih transaksi #${o.order_no}`} /></td>
                <td className="whitespace-nowrap px-3 py-3"><div>{new Date(o.created_at).toLocaleDateString("id-ID")}</div><div className="mt-0.5 text-muted-foreground">{timeLabel(o.created_at)}</div></td>
                <td className="px-3 py-3"><div className="font-semibold">#{o.order_no}</div><div className="mt-0.5 max-w-40 truncate text-muted-foreground">{o.customer_name || o.restaurant_tables?.name || "Walk-in"}</div></td>
                <td className="px-3 py-3">{o.source === "qr" ? "QR" : "Kasir"}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums">{rupiah(o.total)}</td>
                <td className="px-3 py-3">{o.is_paid ? (PAYMENT_LABEL[o.payment_method ?? "cash"] ?? o.payment_method ?? "Cash") : (PAYMENT_LABEL[o.payment_status] ?? "—")}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{rupiah(paid)}</td>
                <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 font-medium ${status === "Lunas" ? "bg-emerald-500/10 text-emerald-700" : status === "Belum lunas" ? "bg-amber-500/10 text-amber-700" : "bg-destructive/10 text-destructive"}`}>{status}</span></td>
                <td className="px-3 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" className="h-8" onClick={() => setSelected(o)}><Eye className="mr-1 size-3.5" />Detail</Button><Button size="icon" variant="ghost" className="size-8 text-destructive" aria-label={`Hapus transaksi #${o.order_no}`} onClick={() => { setSelectedIds([o.id]); beginDelete("selected"); }}><Trash2 className="size-4" /></Button></div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Penghapusan permanen hanya menghapus transaksi yang dipilih beserta item dan pembayaran terkait; produk, stok, dan pengaturan tidak direset.</p>
    </div>
    <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Detail transaksi #{selected?.order_no}</DialogTitle><DialogDescription>{selected ? `${selected.restaurant_tables?.name ?? "Tanpa meja"} · ${timeLabel(selected.created_at)} · ${selected.source === "qr" ? "QR Ordering" : "Kasir"}` : ""}</DialogDescription></DialogHeader>{selected && <div className="space-y-4 text-sm"><div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3"><div><span className="text-xs text-muted-foreground">Pelanggan</span><p className="font-medium">{selected.customer_name || "Walk-in"}</p></div><div><span className="text-xs text-muted-foreground">Status order</span><p className="font-medium">{STATUS_LABEL[selected.status] ?? selected.status}</p></div><div><span className="text-xs text-muted-foreground">Status pembayaran</span><p className="font-medium">{selected.payment_status === "rejected" ? "Ditolak" : selected.is_paid ? "Lunas" : "Belum lunas"}</p></div><div><span className="text-xs text-muted-foreground">Metode</span><p className="font-medium">{PAYMENT_LABEL[selected.payment_method ?? "cash"] ?? selected.payment_method ?? "—"}</p></div></div><div className="divide-y rounded-lg border">{selected.order_items.map(i => <div key={i.id} className="flex justify-between gap-3 p-3"><div className="min-w-0"><p>{i.quantity}× {i.product_name}</p><p className="text-xs text-muted-foreground">{rupiah(i.unit_price)} / item</p>{i.note && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">Catatan: {i.note}</p>}</div><b className="shrink-0 tabular-nums">{rupiah(i.line_total)}</b></div>)}</div><div className="space-y-2 rounded-lg border p-3"><div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{rupiah(selected.subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {rupiah(selected.discount)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Pajak & service</span><span>{rupiah(selected.tax)}</span></div><div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{rupiah(selected.total)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Total dibayar</span><span>{rupiah((selected.payments ?? []).reduce((sum,p) => sum + Number(p.amount || 0), 0))}</span></div>{(selected.payments ?? []).map((p, i) => <div key={i} className="text-xs text-muted-foreground">{PAYMENT_LABEL[p.method] ?? p.method}: {rupiah(p.amount)}{p.cash_received != null ? ` · Tunai diterima ${rupiah(p.cash_received)} · Kembalian ${rupiah(p.change_amount ?? 0)}` : ""}</div>)}</div>{selected.notes && <div className="rounded-lg bg-muted/40 p-3"><b>Catatan order</b><p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.notes}</p></div>}</div>}<DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Tutup</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!confirmMode} onOpenChange={open => { if (!open && !deleteMutation.isPending) { setConfirmMode(null); setConfirmText(""); } }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="size-5" />{confirmMode === "reset" ? "Reset semua transaksi?" : "Hapus transaksi terpilih?"}</DialogTitle><DialogDescription>{confirmMode === "reset" ? `Ini akan menghapus seluruh ${selectedCount} transaksi yang dimuat, termasuk item dan pembayaran terkait. Produk, stok, dan pengaturan tidak ikut dihapus.` : `Ini akan menghapus permanen ${selectedCount} transaksi terpilih beserta item dan pembayaran terkait.`} Tindakan ini tidak dapat dibatalkan.</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="delete-confirm">Ketik persis: <b>{confirmationPhrase}</b></Label><Input id="delete-confirm" value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" placeholder={confirmationPhrase} /><p className="text-xs text-muted-foreground">Tombol konfirmasi aktif hanya jika teks sama persis.</p></div><DialogFooter><Button variant="outline" disabled={deleteMutation.isPending} onClick={() => { setConfirmMode(null); setConfirmText(""); }}>Batal</Button><Button variant="destructive" disabled={confirmText !== confirmationPhrase || deleteMutation.isPending || selectedCount === 0} onClick={confirmDelete}>{deleteMutation.isPending ? "Menghapus…" : "Konfirmasi hapus"}</Button></DialogFooter></DialogContent></Dialog>
  </AppShell>;
}
