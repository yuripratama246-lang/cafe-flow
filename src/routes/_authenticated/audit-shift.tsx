import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, History, Search, ShieldCheck, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useStaffProfile } from "@/lib/access";
import { rupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit-shift")({ component: AuditShiftPage });

type Shift = {
  id: string; owner_id: string; staff_user_id: string; opened_at: string; closed_at: string | null;
  opening_cash: number | string; closing_cash: number | string | null; status: string; note: string | null;
};
type Profile = { user_id: string; full_name: string | null; role: string | null };

function AuditShiftPage() {
  const me = useStaffProfile();
  const [tab, setTab] = useState<"all" | "review" | "active">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shiftsQuery = useQuery({
    queryKey: ["audit-shifts", me.data?.owner_id],
    enabled: !!me.data?.owner_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_shifts").select("*")
        .eq("owner_id", me.data!.owner_id).order("opened_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Shift[];
    },
    refetchInterval: 15000,
  });
  const profilesQuery = useQuery({
    queryKey: ["audit-shift-profiles", me.data?.owner_id],
    enabled: !!me.data?.owner_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_profiles").select("user_id,full_name,role")
        .eq("owner_id", me.data!.owner_id);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
  const shifts = shiftsQuery.data ?? [];
  const profileById = useMemo(() => new Map((profilesQuery.data ?? []).map(p => [p.user_id, p])), [profilesQuery.data]);
  const ordered = useMemo(() => [...shifts].sort((a,b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()), [shifts]);
  const previousById = useMemo(() => {
    const map = new Map<string, Shift | null>();
    ordered.forEach((s, i) => map.set(s.id, i > 0 ? ordered[i - 1] : null));
    return map;
  }, [ordered]);
  const expectedFromNote = (note: string | null) => {
    if (!note) return null;
    const match = note.match(/kas seharusnya\s*Rp\s*([\d.,]+)/i);
    if (!match) return null;
    const value = Number(match[1].replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value) ? value : null;
  };
  const auditFor = (s: Shift) => {
    const flags: { title: string; detail: string; kind: "warning" | "info" }[] = [];
    const prev = previousById.get(s.id) ?? null;
    if (s.status === "open") flags.push({ title: "Shift masih aktif", detail: "Shift belum memiliki data closing.", kind: "info" });
    if (s.status === "closed" && s.closing_cash != null) {
      const expected = expectedFromNote(s.note);
      if (expected != null && Number(s.closing_cash) < expected) flags.push({ title: "Kas closing kurang", detail: `Kurang ${rupiah(expected - Number(s.closing_cash))} dari kas yang seharusnya.`, kind: "warning" });
    }
    if (prev?.status === "closed" && prev.closing_cash != null && Math.abs(Number(s.opening_cash) - Number(prev.closing_cash)) >= 1) {
      flags.push({ title: "Modal opening berbeda", detail: `Closing sebelumnya ${rupiah(prev.closing_cash)}; opening ini ${rupiah(s.opening_cash)} (selisih ${rupiah(Number(s.opening_cash) - Number(prev.closing_cash))}).`, kind: "warning" });
    }
    return { flags, previous: prev, expected: expectedFromNote(s.note) };
  };
  const reviewed = shifts.filter(s => auditFor(s).flags.some(f => f.kind === "warning"));
  const active = shifts.filter(s => s.status === "open");
  const visible = shifts.filter(s => {
    if (tab === "review" && !auditFor(s).flags.some(f => f.kind === "warning")) return false;
    if (tab === "active" && s.status !== "open") return false;
    const p = profileById.get(s.staff_user_id);
    const haystack = [s.id, p?.full_name, p?.role, s.staff_user_id, s.status].join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
  const selected = visible.find(s => s.id === selectedId) ?? shifts.find(s => s.id === selectedId) ?? null;
  const fmtDate = (v: string | null) => v ? new Date(v).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const nameFor = (id: string | null | undefined) => id ? profileById.get(id)?.full_name || "Nama belum tersedia" : "—";

  return <AppShell title="Audit Shift" description="Periksa rekonsiliasi kas dan kesinambungan modal antar-shift">
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<History className="size-5" />} label="Semua shift" value={String(shifts.length)} hint="Opening dan closing tercatat" />
        <Stat icon={<AlertTriangle className="size-5" />} label="Perlu diperiksa" value={String(reviewed.length)} hint="Memiliki indikator audit" warning={reviewed.length > 0} />
        <Stat icon={<Clock3 className="size-5" />} label="Shift aktif" value={String(active.length)} hint="Belum ditutup" />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between gap-3"><CardTitle>Riwayat Opening &amp; Closing</CardTitle><Button variant="outline" size="sm" onClick={() => { void shiftsQuery.refetch(); void profilesQuery.refetch(); }}>Refresh</Button></div>
            <div className="flex flex-wrap gap-2">
              <TabButton active={tab === "all"} onClick={() => setTab("all")}>Semua Shift ({shifts.length})</TabButton>
              <TabButton active={tab === "review"} onClick={() => setTab("review")}>Perlu Diperiksa ({reviewed.length})</TabButton>
              <TabButton active={tab === "active"} onClick={() => setTab("active")}>Shift Aktif ({active.length})</TabButton>
            </div>
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Cari nama kasir atau ID shift…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </CardHeader>
          <CardContent className="space-y-3">
            {shiftsQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Memuat data shift…</p> :
             visible.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><ShieldCheck className="mx-auto mb-2 size-7 text-muted-foreground" /><p className="font-medium">Tidak ada shift di kategori ini</p><p className="mt-1 text-sm text-muted-foreground">Coba kategori lain atau ubah pencarian.</p></div> :
             visible.map(s => {
               const audit = auditFor(s);
               const p = profileById.get(s.staff_user_id);
               return <button key={s.id} type="button" onClick={() => setSelectedId(s.id)} className={`w-full rounded-xl border p-4 text-left transition hover:border-primary/50 hover:bg-muted/20 ${selected?.id === s.id ? "border-primary bg-primary/5" : ""}`}>
                 <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{p?.full_name || "Kasir tidak diketahui"}</p><p className="mt-1 text-xs text-muted-foreground">{fmtDate(s.opened_at)}</p></div><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? "Aktif" : "Ditutup"}</Badge></div>
                 <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Modal opening</p><p className="mt-1 font-semibold">{rupiah(s.opening_cash)}</p></div><div><p className="text-xs text-muted-foreground">Kas closing</p><p className="mt-1 font-semibold">{s.closing_cash == null ? "Belum ditutup" : rupiah(s.closing_cash)}</p></div></div>
                 {audit.flags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{audit.flags.map(f => <Badge key={f.title} variant={f.kind === "warning" ? "destructive" : "secondary"}>{f.title}</Badge>)}</div>}
               </button>;
             })}
            {shiftsQuery.isError && <p className="text-sm text-destructive">Gagal memuat shift. Periksa koneksi atau akses akun.</p>}
          </CardContent>
        </Card>
        <Card className="xl:sticky xl:top-4">
          <CardHeader><CardTitle>Detail Audit Shift</CardTitle><p className="text-sm text-muted-foreground">Pilih baris riwayat untuk melihat pembukaan, penutupan, dan indikator.</p></CardHeader>
          <CardContent>
            {!selected ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Wallet className="mx-auto mb-2 size-7" />Belum ada shift dipilih.</div> : (() => {
              const a = auditFor(selected);
              const prev = a.previous;
              const expected = a.expected;
              const short = expected != null && selected.closing_cash != null && Number(selected.closing_cash) < expected;
              const openingDiff = prev?.closing_cash == null ? null : Number(selected.opening_cash) - Number(prev.closing_cash);
              return <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{nameFor(selected.staff_user_id)}</p><p className="mt-1 break-all text-xs text-muted-foreground">Shift ID: {selected.id}</p></div><Badge variant={a.flags.some(f => f.kind === "warning") ? "destructive" : selected.status === "open" ? "default" : "secondary"}>{a.flags.some(f => f.kind === "warning") ? "Perlu diperiksa" : selected.status === "open" ? "Aktif" : "Tidak ada indikator"}</Badge></div>
                {a.flags.length > 0 ? <div className="space-y-2">{a.flags.map(f => <div key={f.title} className={`rounded-lg border p-3 ${f.kind === "warning" ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/30"}`}><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4" />{f.title}</p><p className="mt-1 text-sm text-muted-foreground">{f.detail}</p></div>)}</div> : <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700"><CheckCircle2 className="mr-2 inline size-4" />Tidak ditemukan indikator dari data yang tersedia.</div>}
                <div className="space-y-3">
                  <Detail label="Waktu opening" value={fmtDate(selected.opened_at)} />
                  <Detail label="Modal opening" value={rupiah(selected.opening_cash)} />
                  <Detail label="Kas seharusnya menurut sistem" value={expected == null ? "Tidak tersedia pada catatan shift" : rupiah(expected)} />
                  <Detail label="Waktu closing" value={fmtDate(selected.closed_at)} />
                  <Detail label="Uang fisik closing" value={selected.closing_cash == null ? "—" : rupiah(selected.closing_cash)} />
                  <Detail label="Selisih kas closing" value={expected == null || selected.closing_cash == null ? "—" : rupiah(Number(selected.closing_cash) - expected)} />
                  <Detail label="Closing shift sebelumnya" value={prev?.closing_cash == null ? "Belum ada data closing sebelumnya" : rupiah(prev.closing_cash)} />
                  <Detail label="Opening ID / akun" value={`${nameFor(selected.staff_user_id)} · ${selected.staff_user_id}`} />
                  <Detail label="Closing ID / akun kasir" value={selected.closed_at ? `${nameFor(selected.staff_user_id)} · ${selected.staff_user_id}` : "Belum ditutup"} />
                  {openingDiff !== null && <Detail label="Selisih opening vs closing sebelumnya" value={rupiah(openingDiff)} />}
                </div>
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catatan shift</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{selected.note || "Tidak ada catatan."}</p></div>
                <p className="text-xs leading-relaxed text-muted-foreground">Indikator membantu menemukan ketidaksesuaian, bukan membuktikan kecurangan. Pastikan perpindahan uang, pengeluaran, dan pergantian kasir sudah dicatat.</p>
              </div>;
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  </AppShell>;
}

function Stat({ icon, label, value, hint, warning = false }: { icon: React.ReactNode; label: string; value: string; hint: string; warning?: boolean }) {
  return <Card><CardContent className="flex items-start gap-3 p-4"><span className={`grid size-10 place-items-center rounded-xl ${warning ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}>{icon}</span><div><p className="text-sm text-muted-foreground">{label}</p><p className="num mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div></CardContent></Card>;
}
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick}>{children}</Button>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 border-b pb-2 sm:flex-row sm:items-start sm:justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className="break-all text-right text-sm font-medium sm:max-w-[60%]">{value}</span></div>;
}
