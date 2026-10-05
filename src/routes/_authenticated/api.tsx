import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, Check, ShieldCheck, Trash2, Ban, RotateCcw, Activity, Code2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/api")({ component: ApiPage });

type ApiKey = { id: string; name: string; key_prefix: string; permissions: string[]; is_active: boolean; expires_at: string | null; last_used_at: string | null; created_at: string };
type ManagerResponse = { keys: ApiKey[]; usage: { total_keys: number; active_keys: number; requests_24h: number }; permissions: string[] };

const LABELS: Record<string, string> = {
  "products:read": "Baca produk",
  "categories:read": "Baca kategori",
  "tables:read": "Baca meja",
  "orders:read": "Baca pesanan",
  "orders:create": "Buat pesanan",
  "customers:read": "Baca pelanggan",
  "reports:read": "Baca laporan",
};

async function manager(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("api-key-manager", { body: { action, ...payload } });
  if (error) throw new Error(error.message || "Gagal memproses API key");
  if (data?.error) throw new Error(data.error);
  return data as ManagerResponse & { key?: string; api_key?: ApiKey };
}

function ApiPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [name, setName] = useState("Website Integration");
  const [selected, setSelected] = useState<string[]>(["products:read", "categories:read", "tables:read", "orders:read"]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const query = useQuery({ queryKey: ["api-keys"], queryFn: () => manager("list"), retry: 1 });
  const create = useMutation({ mutationFn: () => manager("create", { name, permissions: selected }), onSuccess: (data) => { setCreateOpen(false); setNewKey(data.key ?? null); void qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key berhasil dibuat"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuat API key") });
  const action = useMutation({ mutationFn: ({ action, id }: { action: string; id: string }) => manager(action, { id }), onSuccess: () => { setConfirmId(null); void qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key diperbarui"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memperbarui API key") });

  const data = query.data;
  const baseUrl = "https://dbazoxwhhljpgtbnletc.supabase.co/functions/v1/api-v1";
  const toggle = (permission: string) => setSelected((current) => current.includes(permission) ? current.filter((x) => x !== permission) : [...current, permission]);

  return <AppShell title="API & Integrasi" description="Kelola API key untuk website, APK, aplikasi, dan integrasi pihak ketiga" actions={<Button onClick={() => { setName("Website Integration"); setSelected(["products:read", "categories:read", "tables:read", "orders:read"]); setCreateOpen(true); }}><Plus className="mr-2 size-4" />Buat API key</Button>}>
    <div className="grid gap-4 md:grid-cols-3">
      <Stat icon={KeyRound} label="Total key" value={String(data?.usage?.total_keys ?? 0)} />
      <Stat icon={ShieldCheck} label="Key aktif" value={String(data?.usage?.active_keys ?? 0)} />
      <Stat icon={Activity} label="Request 24 jam" value={String(data?.usage?.requests_24h ?? 0)} />
    </div>

    <Card className="mt-4"><CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="size-5" />API v1</CardTitle></CardHeader><CardContent className="space-y-3"><div><p className="text-sm font-medium">Base URL</p><div className="mt-2 rounded-xl bg-muted p-3 font-mono text-xs break-all">{baseUrl}</div></div><div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2"><p><strong>Auth:</strong> gunakan header <code>X-Cafe-Flow-Key</code>.</p><p><strong>Rate limit:</strong> 60 request/menit per key.</p><p><strong>GET:</strong> products, categories, tables, orders, me.</p><p><strong>POST:</strong> orders dengan permission orders:create.</p></div></CardContent></Card>

    <Card className="mt-4"><CardHeader><CardTitle>API keys</CardTitle></CardHeader><CardContent className="space-y-3">{query.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Memuat API key…</p> : query.isError ? <div className="py-8 text-center"><p className="font-medium">Gagal memuat API key</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Coba lagi</Button></div> : data?.keys?.length ? data.keys.map((key) => <div key={key.id} className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /><p className="font-semibold">{key.name}</p><span className={key.is_active ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600" : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"}>{key.is_active ? "AKTIF" : "NONAKTIF"}</span></div><p className="mt-1 font-mono text-xs text-muted-foreground">{key.key_prefix}••••••••</p><p className="mt-1 text-xs text-muted-foreground">{key.permissions.length} permission · dibuat {new Date(key.created_at).toLocaleDateString("id-ID")}{key.last_used_at ? ` · terakhir dipakai ${new Date(key.last_used_at).toLocaleString("id-ID")}` : ""}</p></div><div className="flex gap-2">{key.is_active ? <Button variant="outline" size="sm" onClick={() => action.mutate({ action: "revoke", id: key.id })}><Ban className="mr-2 size-4" />Revoke</Button> : <Button variant="outline" size="sm" onClick={() => action.mutate({ action: "activate", id: key.id })}><RotateCcw className="mr-2 size-4" />Aktifkan</Button>}<Button variant="outline" size="sm" onClick={() => setConfirmId(key.id)}><Trash2 className="mr-2 size-4" />Hapus</Button></div></div>) : <div className="py-10 text-center text-sm text-muted-foreground"><KeyRound className="mx-auto mb-3 size-8 opacity-40" /><p>Belum ada API key.</p><p className="mt-1">Buat key pertama untuk mulai menghubungkan Cafe Flow dengan aplikasi lain.</p></div>}</CardContent></Card>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Buat API key</DialogTitle><DialogDescription>Secret hanya ditampilkan sekali setelah key dibuat. Simpan di tempat aman.</DialogDescription></DialogHeader><div className="space-y-5"><div className="space-y-2"><Label>Nama API key</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Website Integration" /></div><div className="space-y-2"><Label>Permission</Label><div className="grid gap-2 sm:grid-cols-2">{(data?.permissions ?? Object.keys(LABELS)).map((permission) => <label key={permission} className="flex items-center gap-2 rounded-xl border p-3 text-sm"><Checkbox checked={selected.includes(permission)} onCheckedChange={() => toggle(permission)} /><span>{LABELS[permission] ?? permission}</span></label>)}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button><Button disabled={!name.trim() || !selected.length || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Membuat…" : "Buat API key"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!newKey} onOpenChange={(open) => { if (!open) { setNewKey(null); setCopied(false); } }}><DialogContent><DialogHeader><DialogTitle>API key berhasil dibuat</DialogTitle><DialogDescription>Ini satu-satunya saat secret lengkap ditampilkan. Jangan masukkan ke frontend publik atau GitHub.</DialogDescription></DialogHeader><div className="rounded-xl border bg-muted/40 p-4 font-mono text-xs break-all">{newKey}</div><DialogFooter><Button variant="outline" onClick={() => { if (newKey) { void navigator.clipboard.writeText(newKey); setCopied(true); } }}>{copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}{copied ? "Tersalin" : "Copy API key"}</Button><Button onClick={() => setNewKey(null)}>Selesai</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus API key?</AlertDialogTitle><AlertDialogDescription>Key ini akan dihapus permanen dan semua aplikasi yang menggunakannya langsung kehilangan akses.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => confirmId && action.mutate({ action: "delete", id: confirmId })}>Hapus permanen</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AppShell>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof KeyRound; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-full icon-badge icon-badge-transactions"><Icon className="size-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div></CardContent></Card>; }
