import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bluetooth, Printer, RefreshCw, Save, TestTube2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { listBluetoothPrinters, savePrinterConfig, testBluetoothPrinter, getPrinterConfig, type PrinterDevice, type PrinterRole, type SavedPrinter } from "@/lib/bluetooth-printer";

export const Route = createFileRoute("/_authenticated/printer")({ component: PrinterPage });

function PrinterPage() {
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [config, setConfig] = useState<Record<PrinterRole, SavedPrinter | null>>({ kitchen: null, cashier: null });
  const [widths, setWidths] = useState<Record<PrinterRole, 58 | 80>>({ kitchen: 80, cashier: 80 });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setConfig(getPrinterConfig());
    void loadSaved();
  }, []);

  async function loadSaved() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase.from("printer_settings").select("printer_role,printer_name,bluetooth_address,paper_width,is_enabled").eq("owner_id", auth.user.id);
    if (error) { toast.error("Gagal memuat konfigurasi printer: " + error.message); return; }
    const next = getPrinterConfig();
    const nextWidths = { kitchen: 80 as 58 | 80, cashier: 80 as 58 | 80 };
    for (const row of data ?? []) {
      const role = row.printer_role as PrinterRole;
      if (role === "kitchen" || role === "cashier") {
        next[role] = row.is_enabled ? { name: row.printer_name, address: row.bluetooth_address } : null;
        nextWidths[role] = row.paper_width === 58 ? 58 : 80;
      }
    }
    setConfig(next); setWidths(nextWidths);
    savePrinterConfig("kitchen", next.kitchen); savePrinterConfig("cashier", next.cashier);
  }

  async function scan() {
    setBusy(true);
    try { const found = await listBluetoothPrinters(); setDevices(found); toast.success(found.length ? `Ditemukan ${found.length} perangkat Bluetooth` : "Printer tidak ditemukan. Pastikan printer menyala dan sudah dipasangkan."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal mencari perangkat Bluetooth"); }
    finally { setBusy(false); }
  }

  async function choose(role: PrinterRole, address: string) {
    const device = devices.find(d => d.address === address);
    if (!device) return;
    const next = { ...config, [role]: { name: device.name, address: device.address } };
    setConfig(next); savePrinterConfig(role, next[role]);
    toast.success(`Printer ${role === "cashier" ? "kasir" : "dapur"} dipilih`);
  }

  async function saveAll() {
    setBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sesi login tidak ditemukan.");
      for (const role of ["cashier", "kitchen"] as const) {
        const printer = config[role];
        if (!printer) {
          const { error } = await supabase.from("printer_settings").delete().eq("owner_id", auth.user.id).eq("printer_role", role);
          if (error) throw error;
          continue;
        }
        const { error } = await supabase.from("printer_settings").upsert({
          owner_id: auth.user.id, printer_role: role, printer_name: printer.name,
          bluetooth_address: printer.address, paper_width: widths[role], is_enabled: true,
        }, { onConflict: "owner_id,printer_role" });
        if (error) throw error;
      }
      toast.success("Pengaturan printer tersimpan.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menyimpan pengaturan printer"); }
    finally { setBusy(false); }
  }

  async function test(role: PrinterRole) {
    setBusy(true);
    try { await testBluetoothPrinter(role); toast.success("Test print dikirim ke printer."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Test print gagal"); }
    finally { setBusy(false); }
  }

  function clear(role: PrinterRole) {
    const next = { ...config, [role]: null };
    setConfig(next); savePrinterConfig(role, null);
  }

  const roleCard = (role: PrinterRole, title: string, description: string) => (
    <Card key={role}>
      <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="size-5" />{title}</CardTitle><p className="text-sm text-muted-foreground">{description}</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label>Perangkat Bluetooth</Label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={config[role]?.address ?? ""} onChange={e => void choose(role, e.target.value)}>
            <option value="">Pilih printer yang sudah ditemukan</option>
            {devices.map(d => <option key={d.address} value={d.address}>{d.name} — {d.address}</option>)}
            {config[role] && !devices.some(d => d.address === config[role]?.address) && <option value={config[role].address}>{config[role].name} — tersimpan</option>}
          </select>
          {config[role] && <p className="text-xs text-muted-foreground">Terpilih: {config[role]?.name} ({config[role]?.address})</p>}
        </div>
        <div className="space-y-2"><Label>Ukuran kertas</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={widths[role]} onChange={e => setWidths(v => ({ ...v, [role]: Number(e.target.value) as 58 | 80 }))}><option value={58}>58 mm</option><option value={80}>80 mm</option></select></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!config[role] || busy} onClick={() => void test(role)}><TestTube2 className="mr-2 size-4" />Test print</Button><Button variant="outline" disabled={!config[role]} onClick={() => clear(role)}><Trash2 className="mr-2 size-4" />Lepas printer</Button></div>
      </CardContent>
    </Card>
  );

  return <AppShell title="Printer" description="Atur printer Bluetooth terpisah untuk struk kasir dan tiket dapur.">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div><p className="font-semibold">Koneksi printer Bluetooth</p><p className="mt-1 text-sm text-muted-foreground">Pemindaian Bluetooth memerlukan APK Android dan izin Bluetooth. Website biasa tidak dapat mengakses printer Bluetooth ESC/POS secara langsung.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void scan()} disabled={busy}><Bluetooth className="mr-2 size-4" />{busy ? "Memproses…" : "Cari perangkat"}</Button><Button onClick={() => void saveAll()} disabled={busy}><Save className="mr-2 size-4" />Simpan</Button></div>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">{roleCard("cashier", "Printer Kasir", "Untuk struk pembayaran pelanggan.")}{roleCard("kitchen", "Printer Dapur", "Untuk tiket pesanan yang harus disiapkan dapur.")}</div>
    <p className="mt-4 text-xs text-muted-foreground">Catatan: pemilihan dan penyimpanan printer tersedia di halaman ini. Cetak otomatis setelah pembayaran/pesanan dikonfirmasi perlu dihubungkan dan diuji pada alur transaksi APK.</p>
  </AppShell>;
}
