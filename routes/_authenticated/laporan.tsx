import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrders, PAYMENT_LABEL, type OrderWithItems } from "@/lib/pos";
import { endOfDayISO, rupiah, startOfDayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/laporan")({ component: ReportsPage });

async function fetchAllOrders(): Promise<OrderWithItems[]> {
  const pageSize = 1000;
  const rows: OrderWithItems[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("orders")
      .select("*, order_items(*), payments(method, amount, cash_received, change_amount), restaurant_tables(name)")
      .order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as OrderWithItems[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function ReportsPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["orders", "report", "all-time"], queryFn: fetchAllOrders, refetchInterval: 30000 });
  const all = query.data ?? [];
  const filtered = useMemo(() => all.filter((o) => {
    const d = o.created_at.slice(0, 10);
    return (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
  }), [all, fromDate, toDate]);
  const validSales = filtered.filter((o) => o.status !== "cancelled" && o.is_paid);
  const revenue = validSales.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const itemCount = validSales.reduce((sum, o) => sum + o.order_items.reduce((n, item) => n + item.quantity, 0), 0);
  const average = validSales.length ? revenue / validSales.length : 0;

  async function handleDelete(order: OrderWithItems) {
    const ok = window.confirm(`Hapus transaksi #${order.order_no}? Data transaksi, item, dan pembayarannya akan dihapus permanen dari Supabase.`);
    if (!ok) return;
    setDeleting(order.id);
    try {
      const { error } = await supabase.rpc("delete_order_with_details", { p_order_id: order.id });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await query.refetch();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal menghapus transaksi. Data belum dipastikan terhapus.");
    } finally {
      setDeleting(null);
    }
  }

  return <AppShell title="Laporan Penjualan" description="Rekap seluruh transaksi sejak awal, dengan rincian dan pengelolaan data">
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">Dari tanggal</label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">Sampai tanggal</label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        <Button variant="outline" onClick={() => { setFromDate(""); setToDate(""); }}><CalendarDays className="mr-2 size-4" />Semua waktu</Button>
        <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button>
        <span className="text-xs text-muted-foreground">{fromDate || toDate ? "Periode terfilter" : "Dari transaksi pertama sampai terbaru"}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total transaksi lunas", String(validSales.length)],
          ["Total omzet", rupiah(revenue)],
          ["Total item terjual", String(itemCount)],
          ["Rata-rata transaksi", rupiah(average)],
        ].map(([label, value]) => <Card key={label}><CardContent className="p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="num mt-2 text-2xl font-bold">{value}</p></CardContent></Card>)}
      </div>
      <Card><CardContent className="p-0">
        <div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">Detail transaksi</h2><p className="text-xs text-muted-foreground">{filtered.length} transaksi ditemukan · data dari Supabase</p></div></div>
        {query.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Memuat seluruh riwayat transaksi…</p> : query.isError ? <p className="p-8 text-center text-sm text-destructive">Gagal memuat laporan. Coba refresh.</p> : filtered.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Belum ada transaksi pada periode ini.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Tanggal</th><th className="p-3">No. transaksi</th><th className="p-3">Pelanggan</th><th className="p-3">Detail produk</th><th className="p-3">Pembayaran</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Aksi</th></tr></thead>
          <tbody>{filtered.map((o) => <tr key={o.id} className="border-t align-top">
            <td className="whitespace-nowrap p-3">{new Date(o.created_at).toLocaleString("id-ID")}</td>
            <td className="p-3 font-medium">#{o.order_no}<div className="text-xs text-muted-foreground">{o.status === "cancelled" ? "Dibatalkan" : o.is_paid ? "Lunas" : "Belum lunas"}</div></td>
            <td className="p-3">{o.customer_name || "Walk-in"}</td>
            <td className="max-w-[280px] p-3">{o.order_items.map((i) => <div key={i.id}>{i.quantity}× {i.product_name} <span className="text-muted-foreground">({rupiah(i.line_total)})</span></div>)}</td>
            <td className="p-3">{o.is_paid ? PAYMENT_LABEL[o.payment_method ?? "cash"] : "Belum dibayar"}</td>
            <td className="whitespace-nowrap p-3 text-right font-semibold">{rupiah(o.total)}</td>
            <td className="p-3 text-right"><Button variant="destructive" size="sm" disabled={deleting === o.id} onClick={() => handleDelete(o)}><Trash2 className="mr-1 size-4" />{deleting === o.id ? "Menghapus…" : "Hapus"}</Button></td>
          </tr>)}</tbody>
        </table></div>}
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">Penghapusan bersifat permanen dan akan mengurangi angka historis. Transaksi yang dibatalkan tetap terlihat di rincian, tetapi tidak dihitung sebagai omzet/transaksi lunas.</p>
    </div>
  </AppShell>;
}
