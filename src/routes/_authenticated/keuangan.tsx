import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStaffProfile } from "@/lib/access";
import { fetchOrders } from "@/lib/pos";
import { endOfDayISO, rupiah, startOfDayISO, toDateInput } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/keuangan")({ component: FinancePage });
const today = () => toDateInput(new Date());
const firstDay = () => { const d = new Date(); d.setDate(1); return toDateInput(d); };
function FinancePage() {
 const qc=useQueryClient(); const me=useStaffProfile();
 const [amount,setAmount]=useState(""); const [category,setCategory]=useState("Bahan baku"); const [description,setDescription]=useState(""); const [expenseDate,setExpenseDate]=useState(today()); const [method,setMethod]=useState("cash");
 const [from,setFrom]=useState(firstDay()); const [to,setTo]=useState(today());
 const expensesQuery=useQuery({queryKey:["expenses",me.data?.owner_id],enabled:!!me.data?.owner_id,queryFn:async()=>{const {data,error}=await supabase.from("expenses").select("*").eq("owner_id",me.data!.owner_id).order("expense_date",{ascending:false}).limit(1000);if(error)throw error;return data??[];}});
 const expenses=expensesQuery.data??[];
 const save=useMutation({mutationFn:async()=>{if(!me.data)throw new Error("Profil belum siap");const n=Number(amount);if(!Number.isFinite(n)||n<=0)throw new Error("Nominal harus lebih dari Rp0");if(!description.trim())throw new Error("Keterangan wajib diisi");const {error}=await supabase.from("expenses").insert({owner_id:me.data.owner_id,amount:n,category,description:description.trim(),expense_date:expenseDate,payment_method:method});if(error)throw error;},onSuccess:async()=>{setAmount("");setDescription("");await qc.invalidateQueries({queryKey:["expenses"]});toast.success("Pengeluaran tersimpan");},onError:e=>toast.error(e instanceof Error?e.message:"Gagal menyimpan pengeluaran")});
 const filtered=expenses.filter(e=>e.expense_date>=from&&e.expense_date<=to);
 const expenseTotal=filtered.reduce((s,e)=>s+Number(e.amount),0);
 const exportData=()=>{const quote=(v:unknown)=>'"'+String(v??"").replace(/"/g,'""')+'"';const rows=[["Laporan Keuangan Coffee Flow"],["Periode",from,"sampai",to],["Penjualan bersih",report.sales],["HPP / COGS",report.cogs],["Total pengeluaran",expenseTotal],["Laba / (Rugi)",report.profit],[],["Tanggal","Kategori","Keterangan","Metode pembayaran","Nominal (Rp)"],...filtered.map(e=>[e.expense_date,e.category,e.description,e.payment_method,e.amount])];const csv="\uFEFF"+rows.map(row=>row.map(quote).join(",")).join("\r\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="laporan-keuangan-"+from+"-"+to+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast.success("Data keuangan berhasil diekspor");};
 const ordersQuery=useQuery({queryKey:["profit-loss-orders",from,to],queryFn:()=>fetchOrders({from:startOfDayISO(from),to:endOfDayISO(to),limit:3000}),enabled:!!from&&!!to});
 const productsQuery=useQuery({queryKey:["products"],queryFn:async()=>{const {data,error}=await supabase.from("products").select("id,cost_price");if(error)throw error;return data??[];}});
 const report=useMemo(()=>{const products=new Map((productsQuery.data??[]).map(p=>[p.id,Number(p.cost_price??0)]));const paid=(ordersQuery.data??[]).filter(o=>o.is_paid&&o.status!=="cancelled");const sales=paid.reduce((s,o)=>s+Number(o.total),0);const cogs=paid.reduce((s,o)=>s+o.order_items.reduce((n,i)=>n+Number(products.get(i.product_id)??0)*i.quantity,0),0);const missing=paid.reduce((s,o)=>s+o.order_items.filter(i=>!i.product_id||!products.has(i.product_id)||!products.get(i.product_id)).length,0);return {sales,cogs,missing,profit:sales-cogs-expenseTotal};},[ordersQuery.data,productsQuery.data,expenseTotal]);
 return <AppShell title="Keuangan" description="Catat pengeluaran dan pantau laba rugi outlet">
 <div className="mx-auto max-w-6xl space-y-4">
  <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"><div className="space-y-1"><Label>Dari tanggal</Label><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="space-y-1"><Label>Sampai tanggal</Label><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><Button variant="outline" onClick={()=>{setFrom(firstDay());setTo(today());}}>Bulan ini</Button><Button onClick={exportData}><Download className="mr-2 h-4 w-4"/>Ekspor Data</Button></div>
  <Tabs defaultValue="expenses" className="space-y-4"><TabsList><TabsTrigger value="expenses">Kas Keluar</TabsTrigger><TabsTrigger value="pnl">Laporan Laba Rugi</TabsTrigger></TabsList>
   <TabsContent value="expenses" className="space-y-4">
    <Card><CardHeader><CardTitle className="text-base">Tambah Pengeluaran</CardTitle></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();save.mutate();}}>
     <div className="space-y-1"><Label>Nominal (Rp)</Label><Input type="number" min="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Contoh: 25000" required/></div>
     <div className="space-y-1"><Label>Kategori</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Bahan baku","Operasional","Listrik & air","Gaji","Sewa","Perawatan","Transportasi","Lainnya"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
     <div className="space-y-1"><Label>Tanggal</Label><Input type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)} required/></div>
     <div className="space-y-1"><Label>Metode pembayaran</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[["cash","Tunai"],["transfer","Transfer"],["qris","QRIS"],["card","Kartu"],["other","Lainnya"]].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
     <div className="space-y-1 md:col-span-2"><Label>Keterangan</Label><Input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Contoh: beli es batu darurat" required/></div>
     <div className="md:col-span-2"><Button type="submit" disabled={save.isPending}>{save.isPending?"Menyimpan…":"Simpan Pengeluaran"}</Button></div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Riwayat Kas Keluar · {rupiah(expenseTotal)}</CardTitle></CardHeader><CardContent className="space-y-2">{filtered.length?filtered.map(e=><div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{e.description}</p><p className="text-xs text-muted-foreground">{e.expense_date} · {e.category} · {e.payment_method}</p></div><b className="num text-sm">{rupiah(e.amount)}</b></div>):<p className="py-8 text-center text-sm text-muted-foreground">Belum ada pengeluaran pada rentang tanggal ini.</p>}</CardContent></Card>
   </TabsContent>
   <TabsContent value="pnl" className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Penjualan bersih",report.sales],["HPP / COGS",report.cogs],["Total pengeluaran",expenseTotal],["Laba / (Rugi)",report.profit]].map(([label,value])=><Card key={String(label)}><CardContent className="p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="num mt-2 text-xl font-bold">{rupiah(Number(value))}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="text-base">Perhitungan laba rugi</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span>Penjualan dari transaksi lunas (non-cancelled)</span><b className="num">{rupiah(report.sales)}</b></div><div className="flex justify-between"><span>Dikurangi HPP (qty terjual × harga modal produk)</span><b className="num">− {rupiah(report.cogs)}</b></div><div className="flex justify-between"><span>Dikurangi pengeluaran operasional</span><b className="num">− {rupiah(expenseTotal)}</b></div><div className="border-t pt-3 flex justify-between text-base font-bold"><span>Laba / (Rugi) estimasi</span><b className="num">{rupiah(report.profit)}</b></div>{report.missing>0&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">Ada {report.missing} baris item tanpa harga modal. Isi harga modal produk agar HPP dan laba rugi akurat; angka laba saat ini masih terlalu tinggi jika ada biaya produk yang belum diisi.</p>}</CardContent></Card>
   </TabsContent>
  </Tabs>
 </div></AppShell>;
}