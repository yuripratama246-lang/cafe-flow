import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, UserPlus, RefreshCw, UserRound, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useStaffProfile } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

type Owner = { user_id: string; full_name: string; email: string; role: string; is_active: boolean; created_at: string };

function AdminPage() {
  const me = useStaffProfile();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const owners = useQuery({
    queryKey: ["admin-owners"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-owner", { body: { action: "list" } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Gagal memuat owner");
      return (data.owners ?? []) as Owner[];
    },
    enabled: me.data?.role === "super_admin",
  });

  const createOwner = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-owner", {
        body: { full_name: fullName, email },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Gagal membuat akun owner");
      return data;
    },
    onSuccess: () => {
      setFullName("");
      setEmail("");
      void qc.invalidateQueries({ queryKey: ["admin-owners"] });
      toast.success("Akun owner dibuat. Undangan sudah dikirim ke email.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Gagal membuat akun owner"),
  });

  const deleteOwner = useMutation({
    mutationFn: async (owner: Owner) => {
      const confirmed = window.confirm(`Hapus akun Owner ${owner.full_name}?\n\nAkun Supabase Auth dan seluruh data outlet milik Owner ini juga akan terhapus. Tindakan ini tidak dapat dibatalkan.`);
      if (!confirmed) throw new Error("Dibatalkan");
      const { data, error } = await supabase.functions.invoke("create-owner", {
        body: { action: "delete", user_id: owner.user_id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Gagal menghapus akun owner");
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-owners"] });
      toast.success("Akun Owner dan data outletnya berhasil dihapus dari Supabase.");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Dibatalkan") return;
      toast.error(error instanceof Error ? error.message : "Gagal menghapus akun owner");
    },
  });

  if (me.isLoading) return <AppShell title="Admin Cafe Flow" description="Kelola akun owner"><Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Memuat akses…</CardContent></Card></AppShell>;
  if (me.data?.role !== "super_admin") return <AppShell title="Admin Cafe Flow" description="Akses administrator"><Card><CardContent className="py-16 text-center"><ShieldCheck className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-4 font-semibold">Akses terbatas</h2><p className="mt-1 text-sm text-muted-foreground">Halaman ini hanya untuk Admin Cafe Flow.</p></CardContent></Card></AppShell>;

  return (
    <AppShell title="Admin Cafe Flow" description="Buat dan kelola akun Owner untuk client">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus className="size-5" />Tambah akun Owner</CardTitle>
            <CardDescription>Owner menerima email undangan lalu membuat password sendiri.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!email.includes("@")) return toast.error("Email tidak valid"); if (!fullName.trim()) return toast.error("Nama wajib diisi"); createOwner.mutate(); }}>
              <div className="space-y-2"><Label>Nama Owner</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Budi" required /></div>
              <div className="space-y-2"><Label>Email login</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@cafe.com" required /></div>
              <Button type="submit" className="w-full" disabled={createOwner.isPending}><UserPlus className="mr-2 size-4" />{createOwner.isPending ? "Mengirim undangan…" : "Buat akun Owner"}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Daftar Owner</CardTitle><CardDescription>Akun bisnis yang dibuat dari Admin Cafe Flow.</CardDescription></div>
            <Button variant="outline" size="sm" onClick={() => owners.refetch()} disabled={owners.isFetching}><RefreshCw className="mr-2 size-4" />Refresh</Button>
          </CardHeader>
          <CardContent className="p-0">
            {owners.isLoading ? <div className="p-6 text-sm text-muted-foreground">Memuat owner…</div> : owners.isError ? <div className="p-6 text-sm text-destructive">{owners.error instanceof Error ? owners.error.message : "Gagal memuat owner"}</div> : owners.data?.length ? <div className="divide-y">{owners.data.map((owner) => <div key={owner.user_id} className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></div><div className="min-w-0 flex-1"><p className="font-medium">{owner.full_name}</p><p className="truncate text-sm text-muted-foreground">{owner.email}</p></div><Badge variant={owner.is_active ? "default" : "destructive"}>{owner.is_active ? "Aktif" : "Nonaktif"}</Badge><Button variant="destructive" size="sm" onClick={() => deleteOwner.mutate(owner)} disabled={deleteOwner.isPending}><Trash2 className="mr-2 size-4" />Hapus</Button></div>)}</div> : <div className="p-8 text-center text-sm text-muted-foreground">Belum ada akun Owner lain.</div>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
