import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Receipt, Percent, Save, Store, BellRing, Calculator, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import i18n, { languageOptions, type LanguageCode } from "@/locales/i18n";

export const Route = createFileRoute("/_authenticated/pengaturan")({ component: PengaturanPage });
type Settings = { id?: string; owner_id: string; global_theme?: string; name: string; address: string; phone: string; tax_rate: number; service_rate: number; rounding: number; receipt_note: string; receipt_footer: string; transaction_prefix: string; cash_enabled: boolean; card_enabled: boolean; qris_enabled: boolean; app_language?: LanguageCode };
const DEFAULTS = { app_language: "id" as LanguageCode, global_theme: "premium-espresso", name: "Outlet Utama", address: "", phone: "", tax_rate: 11, service_rate: 0, rounding: 0, receipt_note: "", receipt_footer: "Terima kasih sudah berkunjung.", transaction_prefix: "CF", cash_enabled: true, card_enabled: true, qris_enabled: true };

const THEME_PRESETS = [
  { id: "premium-espresso", name: "Premium Espresso", bg: "9 13 17", card: "18 24 31", accent: "245 158 11", mood: "Dark · Amber" },
  { id: "emerald-matcha", name: "Emerald Matcha", bg: "5 11 10", card: "12 20 18", accent: "16 185 129", mood: "Dark · Emerald" },
  { id: "burgundy-roastery", name: "Burgundy Roastery", bg: "15 5 8", card: "25 13 18", accent: "225 29 72", mood: "Dark · Burgundy" },
  { id: "smoked-oakwood", name: "Smoked Oakwood", bg: "12 10 9", card: "23 20 18", accent: "180 83 9", mood: "Dark · Oak" },
  { id: "midnight-cyber", name: "Midnight Cyber", bg: "2 6 23", card: "15 23 42", accent: "56 189 248", mood: "Dark · Cyan" },
  { id: "lavender-haze", name: "Lavender Haze", bg: "15 10 28", card: "26 19 44", accent: "168 85 247", mood: "Dark · Violet" },
  { id: "matte-carbon", name: "Matte Carbon", bg: "18 18 18", card: "30 30 30", accent: "243 244 246", mood: "Dark · Monochrome" },
  { id: "scandinavian-clean", name: "Scandinavian Clean", bg: "248 250 252", card: "255 255 255", accent: "71 85 105", mood: "Light · Slate" },
  { id: "sakura-bakery", name: "Sakura Bakery", bg: "255 247 247", card: "255 255 255", accent: "251 113 133", mood: "Light · Rose" },
  { id: "citrus-juice", name: "Citrus Juice", bg: "254 252 232", card: "255 255 255", accent: "202 138 4", mood: "Light · Citrus" },
  { id: "esb-light-corporate", name: "Corporate Light", bg: "243 244 246", card: "255 255 255", accent: "2 132 199", mood: "Light · Corporate" },
  { id: "soft-sage", name: "Soft Sage", bg: "11 15 13", card: "19 26 23", text: "241 245 243", accent: "135 169 156", mood: "Dark · Soft Tone" },
  { id: "minimalist-oatmilk", name: "Minimalist Oatmilk", bg: "249 246 240", card: "255 255 255", text: "40 35 30", accent: "194 178 159", mood: "Light · Soft Tone" },
  { id: "roasted-hojicha", name: "Roasted Hojicha", bg: "15 12 10", card: "26 21 18", text: "245 242 240", accent: "212 178 149", mood: "Dark · Soft Tone" },
  { id: "dusk-taro", name: "Dusk Taro", bg: "247 245 250", card: "255 255 255", text: "45 40 55", accent: "188 167 232", mood: "Light · Soft Tone" },
] as const;
type ThemeId = typeof THEME_PRESETS[number]["id"];

async function getOwnerId() { const { data, error } = await supabase.auth.getUser(); if (error || !data.user) throw new Error("Belum login"); return data.user.id; }
function PengaturanPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["outlet-settings"], queryFn: async () => { const ownerId = await getOwnerId(); const { data, error } = await supabase.from("outlet_settings").select("*").eq("owner_id", ownerId).maybeSingle(); if (error) throw error; if (data) return data as Settings; const { data: created, error: createError } = await supabase.from("outlet_settings").upsert({ owner_id: ownerId, ...DEFAULTS }, { onConflict: "owner_id" }).select("*").single(); if (createError) throw createError; return created as Settings; }, retry: 1 });
  const [form, setForm] = useState<Settings | null>(null);
  const [activeTheme, setActiveTheme] = useState<ThemeId>("premium-espresso");
  useEffect(() => { if (query.data) { setForm(query.data); const saved = THEME_PRESETS.some((theme) => theme.id === query.data.global_theme) ? query.data.global_theme as ThemeId : "premium-espresso"; setActiveTheme(saved); document.documentElement.setAttribute("data-theme", saved); } }, [query.data]);

  const chooseTheme = async (themeName: ThemeId) => {
    const previous = activeTheme;
    setActiveTheme(themeName);
    document.documentElement.setAttribute("data-theme", themeName);
    try {
      const ownerId = await getOwnerId();
      const { error } = await supabase.from("outlet_settings").update({ global_theme: themeName }).eq("owner_id", ownerId);
      if (error) throw error;
      void qc.invalidateQueries({ queryKey: ["outlet-settings"] });
      toast.success("Tema aplikasi diperbarui");
    } catch (error) {
      setActiveTheme(previous);
      document.documentElement.setAttribute("data-theme", previous);
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan tema");
    }
  };
  const save = useMutation({ mutationFn: async () => { if (!form) return; const clean = { ...form, tax_rate: Math.min(Math.max(Number(form.tax_rate) || 0, 0), 100), service_rate: Math.min(Math.max(Number(form.service_rate) || 0, 0), 100), tax_enabled: Number(form.tax_rate) > 0, service_enabled: Number(form.service_rate) > 0, rounding: Math.max(Number(form.rounding) || 0, 0) }; const { error } = await supabase.from("outlet_settings").upsert(clean, { onConflict: "owner_id" }); if (error) throw error; }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["outlet-settings"] }); toast.success("Pengaturan outlet tersimpan"); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan pengaturan") });
  if (query.isError) return <AppShell title="Pengaturan Outlet" description="Atur identitas, pajak, service, pembayaran, dan struk"><Card><CardContent className="py-12 text-center"><p className="font-medium">Pengaturan gagal dimuat</p><p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : "Terjadi kesalahan."}</p><Button className="mt-4" onClick={() => query.refetch()}>Coba lagi</Button></CardContent></Card></AppShell>;
  if (!form) return <AppShell title="Pengaturan Outlet" description="Atur identitas, pajak, service, pembayaran, dan struk"><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Memuat pengaturan outlet…</CardContent></Card></AppShell>;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm({ ...form, [key]: value });
  const taxOn = form.tax_rate > 0; const serviceOn = form.service_rate > 0;
  return <AppShell title="Pengaturan Outlet" description="Atur identitas, pajak, service, pembayaran, dan struk" actions={<Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />{save.isPending ? "Menyimpan…" : "Simpan perubahan"}</Button>}>
    <div className="grid gap-4 md:grid-cols-4"><Stat icon={Store} label="Outlet" value="1" note="Outlet aktif" /><Stat icon={Percent} label="PPN" value={taxOn ? `${form.tax_rate}%` : "OFF"} note={taxOn ? "Aktif di checkout" : "Tidak dikenakan"} /><Stat icon={Calculator} label="Service" value={serviceOn ? `${form.service_rate}%` : "OFF"} note={serviceOn ? "Aktif di checkout" : "Tidak dikenakan"} /><Stat icon={CreditCard} label="Payment" value={String([form.cash_enabled, form.card_enabled, form.qris_enabled].filter(Boolean).length)} note="Metode aktif" /></div>

    <Card className="mt-4">
      <CardHeader><CardTitle className="flex items-center gap-2">Tema aplikasi <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">15 Presets · 4 Soft Tone</span></CardTitle><p className="text-sm text-muted-foreground">Pilih palet global untuk seluruh tampilan Cafe Flow. Pilihan diterapkan langsung dan disimpan ke outlet.</p></CardHeader>
      <CardContent><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {THEME_PRESETS.map((theme) => <button key={theme.id} type="button" onClick={() => void chooseTheme(theme.id)} aria-pressed={activeTheme === theme.id} className={["rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeTheme === theme.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"].join(" ")}>
          <div className="mb-3 flex items-center gap-2"><span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: "rgb(" + theme.bg + ")" }} /><span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: "rgb(" + theme.card + ")" }} /><span className="size-5 rounded-full border border-black/10" style={{ backgroundColor: "rgb(" + theme.accent + ")" }} /></div>
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{theme.name}</p>{theme.id.startsWith("soft-") || theme.id === "minimalist-oatmilk" || theme.id === "roasted-hojicha" || theme.id === "dusk-taro" ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Soft Tone</span> : null}</div><p className="mt-1 text-xs text-muted-foreground">{theme.mood}</p>
          {activeTheme === theme.id && <p className="mt-2 text-xs font-semibold text-primary">✓ Aktif</p>}
        </button>)}
      </div></CardContent>
    </Card>
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />Profil outlet</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Nama outlet</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div><div className="space-y-2"><Label>Alamat</Label><Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={3} /></div><div className="space-y-2"><Label>No. WhatsApp / Telepon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Percent className="size-5" />PPN & Service</CardTitle></CardHeader><CardContent className="space-y-4"><SettingToggle label="Gunakan PPN" description="PPN ditambahkan otomatis pada checkout kasir dan menu pelanggan." checked={taxOn} onChange={(v) => set("tax_rate", v ? (form.tax_rate || 11) : 0)} /><div className="space-y-2"><Label>Persentase PPN</Label><Input type="number" min="0" max="100" step="0.1" disabled={!taxOn} value={form.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value))} /><p className="text-xs text-muted-foreground">Bisa diubah, misalnya 11%, 10%, atau 0%.</p></div><div className="border-t pt-4" /><SettingToggle label="Gunakan service charge" description="Service charge ditambahkan setelah diskon dan sebelum PPN." checked={serviceOn} onChange={(v) => set("service_rate", v ? (form.service_rate || 5) : 0)} /><div className="space-y-2"><Label>Persentase service</Label><Input type="number" min="0" max="100" step="0.1" disabled={!serviceOn} value={form.service_rate} onChange={(e) => set("service_rate", Number(e.target.value))} /><p className="text-xs text-muted-foreground">Contoh umum 5% atau sesuai kebijakan outlet.</p></div><div className="border-t pt-4 space-y-2"><Label>Pembulatan</Label><Input type="number" min="0" value={form.rounding} onChange={(e) => set("rounding", Number(e.target.value))} /><p className="text-xs text-muted-foreground">Masukkan 100/500/1000 jika ingin pembulatan nominal.</p></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5" />Metode pembayaran</CardTitle></CardHeader><CardContent className="space-y-3"><PaymentRow label="Tunai" description="Terima pembayaran cash di kasir" checked={form.cash_enabled} onChange={(v) => set("cash_enabled", v)} /><PaymentRow label="Kartu" description="Pembayaran kartu/debit" checked={form.card_enabled} onChange={(v) => set("card_enabled", v)} /><PaymentRow label="QRIS" description="Pembayaran QRIS" checked={form.qris_enabled} onChange={(v) => set("qris_enabled", v)} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-5" />Struk & transaksi</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Prefix nomor transaksi</Label><Input value={form.transaction_prefix} onChange={(e) => set("transaction_prefix", e.target.value.toUpperCase())} maxLength={8} /></div><div className="space-y-2"><Label>Catatan struk</Label><Textarea value={form.receipt_note} onChange={(e) => set("receipt_note", e.target.value)} rows={2} /></div><div className="space-y-2"><Label>Footer struk</Label><Textarea value={form.receipt_footer} onChange={(e) => set("receipt_footer", e.target.value)} rows={2} /></div></CardContent></Card>
      <PrinterSettings />
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="size-5" />Kontrol operasional</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-3"><Info title="Notifikasi order" text="Pesanan QR masuk ke antrean Pesanan dan diperbarui otomatis." /><Info title="Inventory" text="Gunakan stok dan ambang stok rendah untuk menjaga ketersediaan menu." /><Info title="QR Ordering" text="PPN, service, dan metode pembayaran outlet ikut tampil di checkout pelanggan." /></div></CardContent></Card>
    </div>
  </AppShell>;
}
function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) { return <div className="flex items-center justify-between gap-4 rounded-2xl border p-4"><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function PaymentRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) { return <div className="flex items-center justify-between rounded-xl border p-3"><div><p className="font-medium text-sm">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function Info({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border bg-muted/20 p-4"><p className="font-medium text-sm">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>; }
function Stat({ icon: Icon, label, value, note }: { icon: typeof Store; label: string; value: string; note: string }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{note}</p></div></CardContent></Card>; }


type PrinterConfig = {
  printerName: string;
  connection: "usb" | "lan" | "wifi" | "bluetooth";
  paperWidth: "58" | "80";
  receiptAutoPrint: boolean;
  kitchenAutoPrint: boolean;
  kitchenPrinterName: string;
};
const PRINTER_CONFIG_KEY = "cafe-flow-printer-config";
const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  printerName: "",
  connection: "usb",
  paperWidth: "80",
  receiptAutoPrint: false,
  kitchenAutoPrint: false,
  kitchenPrinterName: "",
};

function PrinterSettings() {
  const [config, setConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PRINTER_CONFIG_KEY);
      if (raw) setConfig({ ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) });
    } catch {
      // Keep safe defaults if browser storage contains invalid data.
    }
    setLoaded(true);
  }, []);
  function update<K extends keyof PrinterConfig>(key: K, value: PrinterConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }
  function saveConfig() {
    try {
      window.localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(config));
      toast.success("Konfigurasi printer tersimpan di browser ini");
    } catch {
      toast.error("Browser tidak mengizinkan penyimpanan konfigurasi printer");
    }
  }
  function testPrint() {
    const printWindow = window.open("", "_blank", "width=420,height=650");
    if (!printWindow) {
      toast.error("Popup diblokir. Izinkan popup untuk melakukan test print.");
      return;
    }
    const width = config.paperWidth === "58" ? "58mm" : "80mm";
    const safe = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Test Print Cafe Flow</title><style>@page{size:${width} auto;margin:0}*{box-sizing:border-box}body{width:${width};margin:0;padding:4mm;font:10pt/1.4 monospace;color:#000}.center{text-align:center}.line{border-top:1px dashed #000;margin:4mm 0}</style></head><body><div class="center"><b>CAFE FLOW</b><br>TEST PRINT PRINTER</div><div class="line"></div><div>Printer: ${safe(config.printerName || "Belum diberi nama")}</div><div>Koneksi: ${safe(config.connection.toUpperCase())}</div><div>Kertas: ${config.paperWidth} mm</div><div class="line"></div><div class="center">Jika teks ini tercetak dengan jelas,<br>template test print berhasil.</div><div class="line"></div><div class="center">Cafe Flow POS</div></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  }
  return <Card className="xl:col-span-2">
    <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="size-5" />Printer & Struk Thermal</CardTitle><p className="text-sm text-muted-foreground">Siapkan profil printer sebelum perangkat dibeli. Pengaturan disimpan di browser/perangkat ini.</p></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="printer-name">Nama printer kasir</Label><Input id="printer-name" placeholder="Contoh: Printer Kasir 1" value={config.printerName} onChange={(e) => update("printerName", e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="printer-connection">Jenis koneksi</Label><select id="printer-connection" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={config.connection} onChange={(e) => update("connection", e.target.value as PrinterConfig["connection"])}><option value="usb">USB (PC kasir)</option><option value="lan">LAN / Ethernet</option><option value="wifi">Wi-Fi</option><option value="bluetooth">Bluetooth</option></select></div>
        <div className="space-y-2"><Label htmlFor="printer-width">Lebar kertas</Label><select id="printer-width" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={config.paperWidth} onChange={(e) => update("paperWidth", e.target.value as PrinterConfig["paperWidth"])}><option value="58">58 mm</option><option value="80">80 mm</option></select></div>
        <div className="space-y-2"><Label htmlFor="kitchen-printer">Nama printer dapur (opsional)</Label><Input id="kitchen-printer" placeholder="Contoh: Printer Dapur" value={config.kitchenPrinterName} onChange={(e) => update("kitchenPrinterName", e.target.value)} /></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SettingToggle label="Auto-print struk pembayaran" description="Aktifkan sebagai preferensi. Perlu konektor printer untuk cetak otomatis tanpa dialog." checked={config.receiptAutoPrint} onChange={(v) => update("receiptAutoPrint", v)} />
        <SettingToggle label="Auto-print tiket dapur" description="Preferensi tiket order QR masuk. Perlu konektor printer dan pengaturan routing dapur." checked={config.kitchenAutoPrint} onChange={(v) => update("kitchenAutoPrint", v)} />
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><p className="font-medium">Status perangkat: Belum terhubung</p><p className="mt-1 text-muted-foreground">Saat ini konfigurasi dan template test print sudah dapat disiapkan. Pemilihan printer fisik dan cetak otomatis langsung memerlukan printer serta konektor/bridge yang sesuai dengan perangkat kasir.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={testPrint}><Printer className="mr-2 size-4" />Test print template</Button><Button onClick={saveConfig} disabled={!loaded}><Save className="mr-2 size-4" />Simpan konfigurasi printer</Button></div>
    </CardContent>
  </Card>;
}
