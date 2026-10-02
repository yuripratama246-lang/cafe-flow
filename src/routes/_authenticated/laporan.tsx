import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CalendarDays, CreditCard, RefreshCw, ShoppingCart, Wallet, FileText, Store, Clock3, Package, ListOrdered, Download } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchOrders, PAYMENT_LABEL } from "@/lib/pos";
import { endOfDayISO, rupiah, startOfDayISO, toDateInput } from "@/lib/format";
export const Route=createFileRoute("/_authenticated/laporan")({component:ReportsPage});
const FILTERS=[{id:"today",label:"Hari Ini"},{id:"yesterday",label:"Kemarin"},{id:"7days",label:"7 Hari Terakhir"},{id:"month",label:"Bulan Ini"}] as const;
const TABS=[
 {id:"summary",label:"Ringkasan",icon:BarChart3},
 {id:"daily",label:"Sales Daily",icon:CalendarDays},
 {id:"product",label:"Sales Product",icon:Package},
 {id:"hourly",label:"Sales Hourly",icon:Clock3},
 {id:"payment",label:"Payment Report",icon:CreditCard},
 {id:"channel",label:"Channel Report",icon:Store},
 {id:"orders",label:"Order Detail",icon:ListOrdered},
] as const;
type Filter=typeof FILTERS[number]["id"]|"custom";
type Tab=typeof TABS[number]["id"];
function shift(date:string,n:number){const d=new Date(date+"T00:00:00");d.setDate(d.getDate()+n);return toDateInput(d)}
function rangeFor(end:string,filter:Filter){if(filter==="yesterday")return{from:shift(end,-1),to:shift(end,-1)};if(filter==="7days")return{from:shift(end,-6),to:end};if(filter==="month")return{from:end.slice(0,7)+"-01",to:end};return{from:end,to:end}}
function pct(cur:number,prev:number){return prev===0?(cur===0?"0%":null):Math.abs((cur-prev)/prev*100).toFixed(1)+"%"}
function Trend({current,previous,label}:{current:number;previous:number;label:string}){const value=pct(current,previous),up=current>=previous;return <p className={"mt-1 text-[11px] "+(value===null?"text-muted-foreground":up?"text-emerald-600":"text-rose-600")}>{value===null?"Belum ada data pembanding":(up?"↑ ":"↓ ")+value+(up?" naik":" turun")+" dibanding "+label}</p>}
const money=(v:number)=>rupiah(v);
function Table({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[620px] text-sm text-foreground"><thead className="bg-muted text-left text-xs text-muted-foreground"><tr>{headers.map(h=><th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>}
function ReportsPage(){
 const [endDate,setEndDate]=useState(toDateInput(new Date()));
 const [filter,setFilter]=useState<Filter>("today");
 const [tab,setTab]=useState<Tab>(()=>{const requested=new URLSearchParams(window.location.search).get("tab");return TABS.some(t=>t.id===requested)?requested as Tab:"summary"});
 const range=rangeFor(endDate,filter);
 const days=Math.max(1,Math.round((new Date(range.to+"T00:00:00").getTime()-new Date(range.from+"T00:00:00").getTime())/86400000)+1);
 const prevFrom=shift(range.from,-days),prevTo=shift(range.from,-1),trendFrom=shift(endDate,-6);
 const fetchFrom=[range.from,prevFrom,trendFrom].sort()[0],fetchTo=range.to>endDate?range.to:endDate;
 const from=startOfDayISO(fetchFrom),to=endOfDayISO(fetchTo);
 const query=useQuery({queryKey:["orders","report-analytics",range.from,range.to],queryFn:()=>fetchOrders({from,to,limit:2000}),refetchInterval:30000});
 const all=query.data??[];
 const valid=all.filter(o=>o.status!=="cancelled");
 const day=valid.filter(o=>o.created_at>=startOfDayISO(range.from)&&o.created_at<=endOfDayISO(range.to));
 const paid=day.filter(o=>o.is_paid);
 const previous=valid.filter(o=>o.created_at>=startOfDayISO(prevFrom)&&o.created_at<=endOfDayISO(prevTo)&&o.is_paid);
 const gross=paid.reduce((s,o)=>s+Number(o.subtotal),0),sales=paid.reduce((s,o)=>s+Number(o.total),0);
 const prevGross=previous.reduce((s,o)=>s+Number(o.subtotal),0),prevSales=previous.reduce((s,o)=>s+Number(o.total),0);
 const items=day.reduce((s,o)=>s+o.order_items.reduce((n,i)=>n+i.quantity,0),0);
 const avg=paid.length?sales/paid.length:0,prevAvg=previous.length?prevSales/previous.length:0;
 const compare=filter==="today"?"kemarin":filter==="yesterday"?"hari sebelumnya":filter==="month"?"periode sebelumnya":"7 hari sebelumnya";
 const trend=useMemo(()=>Array.from({length:7},(_,i)=>{const d=shift(endDate,i-6),list=all.filter(o=>o.created_at>=startOfDayISO(d)&&o.created_at<=endOfDayISO(d)&&o.status!=="cancelled"&&o.is_paid);return{date:new Date(d+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short"}),sales:list.reduce((s,o)=>s+Number(o.total),0)};}),[all,endDate]);
 const products=useMemo(()=>{const map=new Map<string,{qty:number;revenue:number}>();day.forEach(o=>o.order_items.forEach(i=>{const x=map.get(i.product_name)??{qty:0,revenue:0};x.qty+=i.quantity;x.revenue+=Number(i.line_total);map.set(i.product_name,x)}));return[...map.entries()].sort((a,b)=>b[1].qty-a[1].qty).map(([name,x])=>({name,...x}))},[day]);
 const hours=useMemo(()=>Array.from({length:13},(_,i)=>i+9).map(h=>({hour:String(h).padStart(2,"0")+":00",sales:paid.filter(o=>new Date(o.created_at).getHours()===h).reduce((s,o)=>s+Number(o.total),0),count:paid.filter(o=>new Date(o.created_at).getHours()===h).length})),[paid]);
 const peak=Math.max(0,...hours.map(x=>x.sales));
 const payment=useMemo(()=>{const map=new Map<string,number>();paid.forEach(o=>o.payments?.forEach(p=>map.set(p.method,(map.get(p.method)??0)+Number(p.amount))));return[...map.entries()].sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name:PAYMENT_LABEL[name]??name,value}))},[paid]); const paymentColors=["#80b7a5","#6d9fc7","#d6ad70","#a994cf","#d58e9c","#78a9b5"]; const paymentTotal=payment.reduce((sum,p)=>sum+p.value,0);
 const channels=useMemo(()=>{const map=new Map<string,{orders:number;sales:number}>();paid.forEach(o=>{const key=o.source==="qr"?"QR Order":"Kasir";const x=map.get(key)??{orders:0,sales:0};x.orders++;x.sales+=Number(o.total);map.set(key,x)});return[...map.entries()]},[paid]);
 const daily=useMemo(()=>{const map=new Map<string,{orders:number;gross:number;net:number;items:number}>();paid.forEach(o=>{const date=o.created_at.slice(0,10),x=map.get(date)??{orders:0,gross:0,net:0,items:0};x.orders++;x.gross+=Number(o.subtotal);x.net+=Number(o.total);x.items+=o.order_items.reduce((n,i)=>n+i.quantity,0);map.set(date,x)});return[...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]))},[paid]);
 const cards=[{label:"Penjualan kotor",value:money(gross),icon:Wallet,current:gross,previous:prevGross},{label:"Penjualan bersih",value:money(sales),icon:CreditCard,current:sales,previous:prevSales},{label:"Transaksi lunas",value:String(paid.length),icon:ShoppingCart,current:paid.length,previous:previous.length},{label:"Rata-rata transaksi",value:money(avg),icon:BarChart3,current:avg,previous:prevAvg}];
 const setQuick=(next:Filter)=>{setEndDate(toDateInput(new Date()));setFilter(next)};
 const period=range.from===range.to?range.from:range.from+" – "+range.to;
 const exportReport=()=>{
  const csvCell=(value:unknown)=>{const raw=String(value??"");const safe=/^[=+@\\-\\t\\r]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';};
  const rows:unknown[][]=[];
  const filename="laporan-"+tab+"-"+range.from+"-sampai-"+range.to+".csv";
  if(tab==="summary"){rows.push(["Metrik","Nilai"],["Periode",period],["Penjualan kotor",gross],["Penjualan bersih",sales],["Transaksi lunas",paid.length],["Item terjual",items],["Rata-rata transaksi",avg]);}
  if(tab==="daily"){rows.push(["Tanggal","Transaksi","Item Terjual","Gross Sales","Net Sales"],...daily.map(([date,x])=>[date,x.orders,x.items,x.gross,x.net]));}
  if(tab==="product"){rows.push(["No","Nama Produk","Qty Terjual","Penjualan"],...products.map((p,i)=>[i+1,p.name,p.qty,p.revenue]));}
  if(tab==="hourly"){rows.push(["Jam","Penjualan","Jumlah Transaksi"],...hours.map(h=>[h.hour,h.sales,h.count]));}
  if(tab==="payment"){rows.push(["Metode Pembayaran","Nominal"],...payment.map(p=>[p.name,p.value]));}
  if(tab==="channel"){rows.push(["Kanal","Jumlah Transaksi","Net Sales","Rata-rata Order"],...channels.map(([name,x])=>[name,x.orders,x.sales,x.orders?x.sales/x.orders:0]));}
  if(tab==="orders"){rows.push(["Waktu","Order #","Customer / Meja","Kanal","Status","Pembayaran","Gross","Diskon","Net"],...day.map(o=>[new Date(o.created_at).toLocaleString("id-ID"),o.order_no,o.customer_name||o.restaurant_tables?.name||"Walk-in",o.source==="qr"?"QR Order":"Kasir",o.status,o.is_paid?(PAYMENT_LABEL[o.payment_method??""]??"Lunas"):"Belum lunas",o.subtotal,o.discount,o.total]));}
  const csv="\\uFEFF"+rows.map(row=>row.map(csvCell).join(",")).join("\\r\\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
 };
 return <AppShell title="Laporan Penjualan" description="Analitik penjualan, jam ramai, produk, dan pembayaran" actions={<div className="flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">{FILTERS.map(f=><button key={f.id} onClick={()=>setQuick(f.id)} className={"rounded-md px-2.5 py-1.5 text-xs "+(filter===f.id?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-muted")}>{f.label}</button>)}</div><label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"><CalendarDays className="size-4 text-muted-foreground"/><input aria-label="Tanggal akhir" type="date" value={endDate} onChange={e=>{setEndDate(e.target.value);setFilter("custom")}} className="w-[125px] bg-transparent outline-none"/></label><Button variant="outline" size="sm" onClick={exportReport} disabled={query.isLoading||query.isError}><Download className="mr-2 size-4"/>Export CSV</Button><Button variant="outline" size="sm" onClick={()=>query.refetch()}><RefreshCw className="mr-2 size-4"/>Refresh</Button></div>}>
 <div className="min-h-full space-y-4 bg-background text-foreground">
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c=><Card key={c.label} className="border bg-card text-card-foreground shadow-sm"><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs text-muted-foreground">{c.label}</p>{query.isLoading?<div className="mt-2 h-7 w-28 animate-pulse rounded bg-muted"/>:<p className="num mt-1 text-2xl font-bold text-foreground">{c.value}</p>}<Trend current={c.current} previous={c.previous} label={compare}/></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><c.icon className="size-5"/></div></CardContent></Card>)}</div>
  <div className="rounded-xl border border-border bg-card/80 px-4 py-3 text-xs leading-relaxed text-muted-foreground">Ringkasan menghitung transaksi lunas pada {period}. Pilih tab di bawah untuk melihat laporan terperinci langsung dari data Cafe Flow.</div>
  {query.isLoading?<Card className="border bg-card text-card-foreground shadow-sm"><CardContent className="py-16 text-center text-sm text-muted-foreground">Memuat laporan...</CardContent></Card>:query.isError?<Card className="border bg-card text-card-foreground shadow-sm"><CardContent className="py-12 text-center text-sm text-destructive">Gagal memuat laporan. Coba tekan Refresh.</CardContent></Card>:<>
  {tab==="summary"&&<div className="space-y-4">
   <Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Tren penjualan 7 hari</CardTitle><p className="text-xs text-muted-foreground">Omzet transaksi lunas · berakhir {endDate}</p></CardHeader><CardContent><div className="h-72 rounded-2xl border border-border bg-background p-3"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{top:12,right:12,left:8,bottom:4}}><defs><linearGradient id="salesBlueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#87a99c" stopOpacity={0.4}/><stop offset="100%" stopColor="#87a99c" stopOpacity={0}/></linearGradient><filter id="salesLineGlow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#87a99c" floodOpacity="0.45"/></filter></defs><CartesianGrid stroke="#cbd5e1" strokeOpacity={0.15} strokeDasharray="3 7" vertical={false}/><XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fill:"#64748b",fontSize:11}} tickMargin={10}/><YAxis width={70} tickLine={false} axisLine={false} tick={{fill:"#64748b",fontSize:10}} tickFormatter={v=>money(Number(v)).replace("Rp","")}/><Tooltip formatter={v=>money(Number(v))} labelFormatter={l=>"Tanggal "+l} contentStyle={{background:"rgb(22 31 45)",border:"1px solid rgb(43 57 76)",borderRadius:12,color:"rgb(235 242 250)",fontSize:12}}/><Area type="monotone" dataKey="sales" name="Penjualan" stroke="#87a99c" strokeWidth={3} fill="url(#salesBlueGradient)" dot={{r:4,fill:"#87a99c",stroke:"#ffffff",strokeWidth:2}} activeDot={{r:7,fill:"#87a99c",stroke:"#dce8e2",strokeWidth:2}} style={{filter:"drop-shadow(0px 6px 16px rgba(135, 169, 156, 0.18))"}}/></AreaChart></ResponsiveContainer></div></CardContent></Card>
   <div className="grid gap-4 xl:grid-cols-2"><Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Jam ramai</CardTitle></CardHeader><CardContent><div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={hours}><defs><linearGradient id="hourlyGreenGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#87a99c" stopOpacity={1}/><stop offset="100%" stopColor="#87a99c" stopOpacity={0.35}/></linearGradient></defs><CartesianGrid strokeDasharray="3 6" vertical={false}/><XAxis tickLine={false} axisLine={false} dataKey="hour" tick={{fontSize:10}}/><YAxis tickLine={false} axisLine={false} domain={[0,peak>0?Math.ceil(peak/100000)*100000:100]} tickFormatter={v=>money(Number(v)).replace("Rp","")} width={65}/><Tooltip formatter={v=>money(Number(v))}/><Bar dataKey="sales" name="Penjualan" fill="url(#hourlyGreenGradient)" radius={[8, 8, 0, 0]} maxBarSize={34}/></BarChart></ResponsiveContainer></div><p className="mt-2 text-xs text-muted-foreground">{peak>0?"Peak: "+hours.filter(h=>h.sales===peak).map(h=>h.hour).join(", ")+" · "+money(peak):"Belum ada transaksi pada periode ini."}</p></CardContent></Card><Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Komposisi kanal order</CardTitle></CardHeader><CardContent>{channels.length?<div className="grid items-center gap-4 sm:grid-cols-[minmax(150px,0.9fr)_minmax(0,1.1fr)]"><div className="h-52 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={channels.map(([name,x])=>({name,value:x.sales}))} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="none">{channels.map(([name],index)=><Cell key={name} fill={paymentColors[index%paymentColors.length]}/>)}</Pie><Tooltip formatter={v=>money(Number(v))}/></PieChart></ResponsiveContainer></div><div className="space-y-3">{channels.map(([name,x],index)=><div key={name} className="flex items-center gap-3 text-sm"><span className="size-3 shrink-0 rounded-full" style={{backgroundColor:paymentColors[index%paymentColors.length]}}/><span className="min-w-0 flex-1">{name}<span className="block text-xs text-muted-foreground">{x.orders} transaksi</span></span><b>{money(x.sales)}</b></div>)}</div></div>:<p className="py-10 text-center text-sm text-muted-foreground">Belum ada transaksi lunas.</p>}</CardContent></Card></div>
  </div>}
  {tab==="daily"&&<Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Sales Daily</CardTitle><p className="text-xs text-muted-foreground">Rekap per tanggal, hanya transaksi lunas dan tidak dibatalkan.</p></CardHeader><CardContent>{daily.length?<Table headers={["Tanggal","Transaksi","Item Terjual","Gross Sales","Net Sales"]}>{daily.map(([date,x])=><tr key={date}><td className="whitespace-nowrap px-4 py-3">{date}</td><td className="px-4 py-3">{x.orders}</td><td className="px-4 py-3">{x.items}</td><td className="px-4 py-3">{money(x.gross)}</td><td className="px-4 py-3 font-semibold">{money(x.net)}</td></tr>)}</Table>:<Empty/>}</CardContent></Card>}
  {tab==="product"&&<Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Sales Product</CardTitle><p className="text-xs text-muted-foreground">Jumlah dan omzet item yang terjual dalam periode.</p></CardHeader><CardContent>{products.length?<Table headers={["#","Nama Produk","Qty Terjual","Penjualan"]}>{products.map((p,i)=><tr key={p.name}><td className="px-4 py-3">{i+1}</td><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{p.qty}</td><td className="px-4 py-3">{money(p.revenue)}</td></tr>)}</Table>:<Empty/>}</CardContent></Card>}
  {tab==="hourly"&&<Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Sales Hourly</CardTitle><p className="text-xs text-muted-foreground">Penjualan dan jumlah transaksi per jam. Jam tertinggi ditandai hijau.</p></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={hours}><defs><linearGradient id="hourlyGreenGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#87a99c" stopOpacity={1}/><stop offset="100%" stopColor="#87a99c" stopOpacity={0.35}/></linearGradient></defs><CartesianGrid strokeDasharray="3 6" vertical={false}/><XAxis tickLine={false} axisLine={false} dataKey="hour" tick={{fontSize:11}}/><YAxis tickLine={false} axisLine={false} domain={[0,peak>0?Math.ceil(peak/100000)*100000:100]} tickFormatter={v=>money(Number(v)).replace("Rp","")} width={65}/><Tooltip formatter={v=>money(Number(v))}/><Bar dataKey="sales" name="Penjualan" fill="url(#hourlyGreenGradient)" radius={[8, 8, 0, 0]} maxBarSize={34}/></BarChart></ResponsiveContainer></div>{hours.some(h=>h.sales>0)&&<p className="mt-3 text-sm text-emerald-600">Jam puncak: {hours.filter(h=>h.sales===peak).map(h=>h.hour).join(", ")} — {money(peak)}</p>}</CardContent></Card>}
  {tab==="payment"&&<Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Payment Report</CardTitle><p className="text-xs text-muted-foreground">Rincian nominal pembayaran berdasarkan metode pembayaran.</p></CardHeader><CardContent>{payment.length?<div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
   <div className="mx-auto h-[260px] w-full max-w-[320px] min-w-0">
    <ResponsiveContainer width="100%" height="100%">
     <PieChart>
      <Pie data={payment} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={85} paddingAngle={2} cornerRadius={4} stroke="none">
       {payment.map((entry,index)=><Cell key={entry.name} fill={index===0?"rgb(var(--color-primary))":paymentColors[index%paymentColors.length]}/>)}
      </Pie>
      <Tooltip formatter={v=>money(Number(v))} contentStyle={{backgroundColor:"#11161d",borderColor:"rgba(255,255,255,0.08)",borderRadius:"8px",color:"#fff"}} itemStyle={{color:"#fff"}} labelStyle={{color:"#fff"}}/>
     </PieChart>
    </ResponsiveContainer>
   </div>
   <div className="min-w-0 space-y-3">
    {payment.map(({name,value},index)=>{
     const share=paymentTotal?(value/paymentTotal)*100:0;
     return <div key={name} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/60 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
       <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{backgroundColor:index===0?"rgb(var(--color-primary))":paymentColors[index%paymentColors.length]}}/>
       <span className="truncate text-sm font-medium text-foreground">{name}</span>
      </div>
      <div className="shrink-0 text-right">
       <div className="text-sm font-bold tabular-nums text-foreground">{money(value)}</div>
       <div className="text-xs text-muted-foreground">{share.toFixed(1)}%</div>
      </div>
     </div>;
    })}
   </div>
  </div>:<Empty/>}</CardContent></Card>}
  {tab==="channel"&&<Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Channel Report</CardTitle><p className="text-xs text-muted-foreground">Perbandingan transaksi dari kasir dan QR order.</p></CardHeader><CardContent>{channels.length?<Table headers={["Kanal","Jumlah Transaksi","Net Sales","Rata-rata Order"]}>{channels.map(([name,x])=><tr key={name}><td className="px-4 py-3">{name}</td><td className="px-4 py-3">{x.orders}</td><td className="px-4 py-3 font-semibold">{money(x.sales)}</td><td className="px-4 py-3">{money(x.orders?x.sales/x.orders:0)}</td></tr>)}</Table>:<Empty/>}</CardContent></Card>}
  {tab==="orders"&&<Card className="border bg-card text-card-foreground shadow-sm"><CardHeader><CardTitle className="text-base">Order Detail</CardTitle><p className="text-xs text-muted-foreground">Daftar transaksi pada rentang tanggal terpilih.</p></CardHeader><CardContent>{day.length?<Table headers={["Waktu","Order #","Customer / Meja","Kanal","Status","Pembayaran","Gross","Diskon","Net"]}>{day.map(o=><tr key={o.id}><td className="whitespace-nowrap px-4 py-3">{new Date(o.created_at).toLocaleString("id-ID",{dateStyle:"short",timeStyle:"short"})}</td><td className="px-4 py-3">#{o.order_no}</td><td className="px-4 py-3">{o.customer_name||o.restaurant_tables?.name||"Walk-in"}</td><td className="px-4 py-3">{o.source==="qr"?"QR Order":"Kasir"}</td><td className="px-4 py-3"><Badge variant={o.status==="cancelled"?"destructive":"secondary"}>{o.status}</Badge></td><td className="px-4 py-3">{o.is_paid?(PAYMENT_LABEL[o.payment_method??""]??"Lunas"):"Belum lunas"}</td><td className="px-4 py-3">{money(Number(o.subtotal))}</td><td className="px-4 py-3">{money(Number(o.discount))}</td><td className="px-4 py-3 font-semibold">{money(Number(o.total))}</td></tr>)}</Table>:<Empty/>}</CardContent></Card>}
  </>}
 </div>
 </AppShell>
}
function Empty(){return <div className="py-14 text-center text-sm text-muted-foreground">Belum ada data untuk periode ini.</div>}
