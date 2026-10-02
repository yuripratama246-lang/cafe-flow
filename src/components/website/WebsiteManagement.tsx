import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Globe, FileText, Images, MapPin, BriefcaseBusiness, Contact, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

type Kind = "pages" | "gallery" | "locations" | "contact" | "careers" | "settings";
type Field = { key: string; label: string; type?: "text" | "textarea" | "json" | "boolean" | "number"; required?: boolean; placeholder?: string };
const configs: Record<Kind, { title: string; table: string; fields: Field[]; columns: string[] }> = {
 pages: { title: "Pages", table: "website_pages", columns: ["title","slug","status"], fields: [{key:"title",label:"Title",required:true},{key:"slug",label:"Slug",required:true,placeholder:"home / about / contact"},{key:"content",label:"Content (JSON)",type:"json"},{key:"status",label:"Status",placeholder:"draft atau published",required:true},{key:"seo_meta",label:"SEO Meta (JSON)",type:"json"}] },
 gallery: { title: "Gallery", table: "website_gallery", columns: ["title","image_path","is_active"], fields: [{key:"image_path",label:"Image URL / path",required:true},{key:"title",label:"Title"},{key:"caption",label:"Caption",type:"textarea"},{key:"sort_order",label:"Sort order",type:"number"},{key:"is_active",label:"Active",type:"boolean"}] },
 locations: { title: "Locations", table: "website_locations", columns: ["name","address","is_active"], fields: [{key:"name",label:"Name",required:true},{key:"address",label:"Address",type:"textarea"},{key:"phone",label:"Phone"},{key:"contact_info",label:"Other contact info (JSON)",type:"json"},{key:"opening_hours",label:"Opening hours (JSON)",type:"json"},{key:"latitude",label:"Latitude",type:"number"},{key:"longitude",label:"Longitude",type:"number"},{key:"is_active",label:"Active",type:"boolean"}] },
 contact: { title: "Contact", table: "website_contacts", columns: ["email","phone","whatsapp"], fields: [{key:"email",label:"Email"},{key:"phone",label:"Phone"},{key:"whatsapp",label:"WhatsApp"},{key:"address",label:"Address",type:"textarea"},{key:"social_links",label:"Social links (JSON)",type:"json"},{key:"contact_info",label:"Other contact info (JSON)",type:"json"}] },
 careers: { title: "Careers", table: "website_careers", columns: ["title","department","is_active"], fields: [{key:"title",label:"Title",required:true},{key:"department",label:"Department"},{key:"location",label:"Location"},{key:"employment_type",label:"Employment type"},{key:"description",label:"Description",type:"textarea",required:true},{key:"requirements",label:"Requirements (JSON array)",type:"json"},{key:"is_active",label:"Active",type:"boolean"}] },
 settings: { title: "Website Settings", table: "website_settings", columns: ["site_name","tagline"], fields: [{key:"site_name",label:"Site name",required:true},{key:"tagline",label:"Tagline"},{key:"logo_path",label:"Logo URL / path"},{key:"favicon_path",label:"Favicon URL / path"},{key:"social_links",label:"Social links (JSON)",type:"json"},{key:"seo_meta",label:"SEO/meta (JSON)",type:"json"},{key:"branding",label:"Branding/theme (JSON)",type:"json"}] },
};
const links: {kind:Kind;label:string;path:string;icon:typeof FileText}[] = [
 {kind:"pages",label:"Pages",path:"/website-management/pages",icon:FileText},{kind:"gallery",label:"Gallery",path:"/website-management/gallery",icon:Images},{kind:"locations",label:"Locations",path:"/website-management/locations",icon:MapPin},{kind:"contact",label:"Contact",path:"/website-management/contact",icon:Contact},{kind:"careers",label:"Careers",path:"/website-management/careers",icon:BriefcaseBusiness},{kind:"settings",label:"Settings",path:"/website-management/settings",icon:Settings2},
];
const client = supabase as any;
function emptyRow(kind: Kind) { return Object.fromEntries(configs[kind].fields.map(f => [f.key, f.type === "boolean" ? true : f.type === "json" ? (f.key === "requirements" ? "[]" : "{}") : ""])); }
function display(v: unknown) { return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? ""); }
function normalize(row: Record<string, unknown>, kind: Kind) {
 const result: Record<string, unknown> = {};
 for (const f of configs[kind].fields) {
  const v = row[f.key];
  if (f.type === "json") { try { result[f.key] = typeof v === "string" ? JSON.parse(v || (f.key === "requirements" ? "[]" : "{}")) : v ?? (f.key === "requirements" ? [] : {}); } catch { throw new Error(f.label + " harus berupa JSON valid"); } }
  else if (f.type === "boolean") result[f.key] = Boolean(v);
  else if (f.type === "number") result[f.key] = v === "" || v == null ? null : Number(v);
  else result[f.key] = typeof v === "string" ? v.trim() || null : v;
  if (f.required && (result[f.key] === null || result[f.key] === "")) throw new Error(f.label + " wajib diisi");
 }
 return result;
}
export function WebsiteManagementPage({ kind }: { kind: Kind }) {
 const cfg = configs[kind], qc = useQueryClient(), [editing,setEditing] = useState<Record<string, any>|null>(null);
 const query = useQuery({ queryKey:["website-cms",cfg.table], queryFn:async()=>{const {data,error}=await client.from(cfg.table).select("*").order("created_at",{ascending:false});if(error)throw error;return data??[];} });
 const save = useMutation({ mutationFn:async()=>{if(!editing) return; const payload=normalize(editing,kind); const result=editing.id ? await client.from(cfg.table).update({...payload,updated_at:new Date().toISOString()}).eq("id",editing.id) : await client.from(cfg.table).insert(payload); if(result.error)throw result.error; }, onSuccess:async()=>{setEditing(null);await qc.invalidateQueries({queryKey:["website-cms"]});toast.success("Data website tersimpan");},onError:e=>toast.error(e instanceof Error?e.message:"Gagal menyimpan data")});
 const remove=useMutation({mutationFn:async(id:string)=>{const {error}=await client.from(cfg.table).delete().eq("id",id);if(error)throw error;},onSuccess:async()=>{await qc.invalidateQueries({queryKey:["website-cms"]});toast.success("Data dihapus");},onError:e=>toast.error(e instanceof Error?e.message:"Gagal menghapus data")});
 const rows=query.data??[];
 return <AppShell title={"Management Website · "+cfg.title} description="Kelola konten company website Cafe Flow">
  <div className="mx-auto max-w-6xl space-y-4">
   <div className="flex flex-wrap gap-2">{links.map(x=><Button key={x.kind} variant={x.kind===kind?"default":"outline"} size="sm" asChild><Link to={x.path}>{x.label}</Link></Button>)}</div>
   <Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-base">{cfg.title}</CardTitle><Button onClick={()=>setEditing(emptyRow(kind))}><Plus className="mr-2 size-4"/>Tambah</Button></CardHeader><CardContent className="space-y-3">
    {query.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Memuat data…</p> : query.isError ? <p className="py-8 text-center text-sm text-destructive">Gagal memuat data. Periksa koneksi dan akses akun.</p> : rows.length===0 ? <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data.</p> : rows.map((row:any)=><div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><div className="min-w-0 flex-1"><p className="font-medium break-words">{cfg.columns.map(k=>display(row[k])).filter(Boolean).join(" · ") || "Untitled"}</p><p className="text-xs text-muted-foreground">Dibuat: {row.created_at ? new Date(row.created_at).toLocaleDateString("id-ID") : "—"}</p></div>{row.status && <Badge variant={row.status==="published"?"default":"secondary"}>{row.status}</Badge>}{typeof row.is_active==="boolean"&&<Badge variant={row.is_active?"default":"outline"}>{row.is_active?"Aktif":"Nonaktif"}</Badge>}<Button size="icon" variant="outline" aria-label="Edit" onClick={()=>setEditing(Object.fromEntries(cfg.fields.map(f=>[f.key,f.type==="json"?JSON.stringify(row[f.key]??(f.key==="requirements"?[]:{}),null,2):row[f.key]??""]).concat([["id",row.id]])))}><Pencil className="size-4"/></Button><Button size="icon" variant="ghost" aria-label="Hapus" disabled={remove.isPending} onClick={()=>{if(window.confirm("Hapus data ini?"))remove.mutate(row.id)}}><Trash2 className="size-4"/></Button></div>)}
   </CardContent></Card>
  </div>
  <Dialog open={!!editing} onOpenChange={v=>{if(!v)setEditing(null)}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?.id?"Edit":"Tambah"} {cfg.title}</DialogTitle></DialogHeader>{editing&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();save.mutate()}}>
   {cfg.fields.map(f=><div className="space-y-2" key={f.key}>{f.type==="boolean"?<label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(editing[f.key])} onChange={e=>setEditing({...editing,[f.key]:e.target.checked})}/>{f.label}</label>:<><Label htmlFor={"website-"+f.key}>{f.label}</Label>{f.type==="textarea"||f.type==="json"?<Textarea id={"website-"+f.key} rows={f.type==="json"?6:4} required={f.required} value={display(editing[f.key])} placeholder={f.placeholder} onChange={e=>setEditing({...editing,[f.key]:e.target.value})}/>:<Input id={"website-"+f.key} type={f.type==="number"?"number":"text"} required={f.required} value={display(editing[f.key])} placeholder={f.placeholder} onChange={e=>setEditing({...editing,[f.key]:e.target.value})}/>}</>}</div>)}
   <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>setEditing(null)}>Batal</Button><Button type="submit" disabled={save.isPending}>{save.isPending?"Menyimpan…":"Simpan"}</Button></div>
  </form>}</DialogContent></Dialog>
 </AppShell>;
}
export function WebsiteOverview() {
 const specs=[["website_pages","Halaman"],["website_gallery","Gallery"],["website_locations","Lokasi"],["website_careers","Lowongan aktif"]] as const;
 const queries=useQuery({queryKey:["website-overview"],queryFn:async()=>{const counts=await Promise.all(specs.map(async([table])=>{let q=client.from(table).select("id",{count:"exact",head:true});if(table==="website_careers")q=q.eq("is_active",true);const {count,error}=await q;if(error)throw error;return count??0;}));return counts;}});
 const [pageCount,galleryCount,locationCount,careerCount]=queries.data??[0,0,0,0];
 return <AppShell title="Management Website" description="Kelola konten company website Cafe Flow">
  <div className="mx-auto max-w-6xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5"><div><p className="text-sm text-muted-foreground">Status website</p><p className="mt-1 text-lg font-semibold">CMS siap dikelola</p><p className="text-xs text-muted-foreground">Konten tersimpan di domain website_* terpisah dari POS dan QR Ordering.</p></div><Badge variant="secondary"><Globe className="mr-1 size-3"/>Website CMS</Badge></div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Halaman",pageCount],["Gallery",galleryCount],["Lokasi",locationCount],["Lowongan aktif",careerCount]].map(([label,count])=><Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums">{queries.isLoading?"—":count}</p></CardContent></Card>)}</div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{links.map(({kind,label,path,icon:Icon})=><Card key={kind} className="transition-colors hover:border-primary/40"><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5"/></div><div className="min-w-0 flex-1"><p className="font-medium">{label}</p><p className="text-xs text-muted-foreground">Kelola {label.toLowerCase()}</p></div><Button size="sm" variant="outline" asChild><Link to={path}>Buka</Link></Button></CardContent></Card>)}</div>
  </div>
 </AppShell>;
}
