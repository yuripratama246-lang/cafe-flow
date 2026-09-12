import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, QrCode, Users, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchTables } from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/meja")({ component: TablesPage });

function TablesPage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["tables"], queryFn: fetchTables, refetchInterval: 10000 });
  const tables = query.data ?? [];

  return (
    <AppShell
      title="Meja"
      description="Kelola meja, status, dan QR Menu"
      actions={<div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => query.refetch()}><RefreshCw className="mr-2 size-4" />Refresh</Button><Button size="sm"><Plus className="mr-2 size-4" />Tambah Meja</Button></div>}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><CheckCircle2 className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Total meja</p><p className="text-xl font-bold">{tables.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Users className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">QR aktif</p><p className="text-xl font-bold">{tables.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><QrCode className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Siap dipakai</p><p className="text-xl font-bold">{tables.length}</p></div></CardContent></Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((table) => (
          <Card key={table.id} className="overflow-hidden">
            <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle>{table.name}</CardTitle><Badge variant="secondary">Kosong</Badge></div></CardHeader>
            <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Kode: {table.code}</p><Button className="w-full" variant="outline"><QrCode className="mr-2 size-4" />Lihat QR Menu</Button></CardContent>
          </Card>
        ))}
        {tables.length === 0 && <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4"><CardContent className="py-14 text-center text-sm text-muted-foreground">Belum ada meja di database.</CardContent></Card>}
      </div>
    </AppShell>
  );
}
