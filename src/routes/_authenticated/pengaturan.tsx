import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Receipt, Percent, Save, Store, BellRing, Calculator, Printer, Languages } from "lucide-react";
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
type Settings = { id?: string; owner_id: string; name: string; address: string; phone: string; tax_rate: number; service_rate: number; rounding: number; receipt_note: string; receipt_footer: string; transaction_prefix: string; cash_enabled: boolean; card_enabled: boolean; qris_enabled: boolean; app_language?: LanguageCode };
const DEFAULTS = { app_language: "id" as LanguageCode, name: "Outlet Utama", address: "", phone: "", tax_rate: 11, service_rate: 0, rounding: 0, receipt_note: "", receipt_footer: "Terima kasih sudah berkunjung.", transaction_prefix: "CF", cash_enabled: true, card_enabled: true, qris_enabled: true };

async function getOwnerId() { const { data, error } = await supabase.auth.getUser(); if (error || !data.user) throw new Error("Belum login"); return data.user.id; }
function PengaturanPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["outlet-settings"], queryFn: async () => { const ownerId = await getOwnerId(); const { data, error } = await supabase.from("outlet_settings").select("*").eq("owner_id", ownerId).maybeSingle(); if (error) throw error; if (data) return data as Settings; const { data: created, error: createError } = await supabase.from("outlet_settings").upsert({ owner_id: ownerId, ...DEFAULTS }, { onConflict: "owner_id" }).select("*").single(); if (createError) throw createError; return created as Settings; }, retry: 1 });
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (query.data) { setForm(query.data); const savedLanguage = query.data.app_language; if (savedLanguage && languageOptions.some((option) => option.code === savedLanguage)) { window.localStorage.setItem("cafe-flow-language", savedLanguage); void i18n.changeLanguage(savedLanguage); } } }, [query.data]);
  const save = useMutation({ mutationFn: async () => { if (!form) return; const clean = { ...form, tax_rate: Math.min(Math.max(Number(form.tax_rate) || 0, 0), 100), service_rate: Math.min(Math.max(Number(form.service_rate) || 0, 0), 100), tax_enabled: Number(form.tax_rate) > 0, service_enabled: Number(form.service_rate) > 0, rounding: Math.max(Number(form.rounding) || 0, 0) }; const { error } = await supabase.from("outlet_settings").upsert(clean, { onConflict: "owner_id" }); if (error) throw error; }, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["outlet-settings"] }); toast.success(t("settings.saved")); }, onError: (e) => toast.error(e instanceof Error ? e.message : t("settings.saveError")) });
  if (query.isError) return <AppShell title={t("settings.title")} description={t("settings.description")}><Card><CardContent className="py-12 text-center"><p className="font-medium">Pengaturan gagal dimuat</p><p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : t("settings.errorOccurred")}</p><Button className="mt-4" onClick={() => query.refetch()}>{t("settings.retry")}</Button></CardContent></Card></AppShell>;
  if (!form) return <AppShell title={t("settings.title")} description={t("settings.description")}><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Memuat pengaturan outlet…</CardContent></Card></AppShell>;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm({ ...form, [key]: value });
  const taxOn = form.tax_rate > 0; const serviceOn = form.service_rate > 0;
  return <AppShell title={t("settings.title")} description={t("settings.description")} actions={<Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-2 size-4" />{save.isPending ? t("settings.saving") : t("settings.save")}</Button>}>
    <div className="grid gap-4 md:grid-cols-4"><Stat icon={Store} label={t("settings.outlet")} value="1" note={t("settings.activeOutlet")} /><Stat icon={Percent} label={t("settings.taxService")} value={taxOn ? `${form.tax_rate}%` : "OFF"} note={taxOn ? t("settings.taxOn") : t("settings.taxOff")} /><Stat icon={Calculator} label={t("settings.useService")} value={serviceOn ? `${form.service_rate}%` : "OFF"} note={serviceOn ? t("settings.serviceOn") : t("settings.serviceOff")} /><Stat icon={CreditCard} label={t("settings.paymentMethods")} value={String([form.cash_enabled, form.card_enabled, form.qris_enabled].filter(Boolean).length)} note={t("settings.paymentActive")} /></div>

    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />{t("settings.outletProfile")}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>{t("settings.outletName")}</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div><div className="space-y-2"><Label>{t("settings.address")}</Label><Textarea value={form.address} onChange={(e) => set("address", e.target.value)} rows={3} /></div><div className="space-y-2"><Label>{t("settings.phone")}</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Languages className="size-5" />{t("settings.languageTitle")}</CardTitle><p className="text-sm text-muted-foreground">{t("settings.languageDescription")}</p></CardHeader><CardContent className="space-y-3"><Label htmlFor="app-language">{t("settings.languageLabel")}</Label><select id="app-language" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.app_language ?? "id"} onChange={(e) => { const language = e.target.value as LanguageCode; set("app_language", language); window.localStorage.setItem("cafe-flow-language", language); void i18n.changeLanguage(language); }}><option value="id">🇮🇩 Bahasa Indonesia</option><option value="en">🇬🇧 English</option><option value="zh">🇨🇳 中文（简体）</option><option value="th">🇹🇭 ภาษาไทย</option></select><p className="text-xs text-muted-foreground">{t("settings.languageHelp")}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Percent className="size-5" />{t("settings.taxService")}</CardTitle></CardHeader><CardContent className="space-y-4"><SettingToggle label={t("settings.useTax")} description={t("settings.taxDescription")} checked={taxOn} onChange={(v) => set("tax_rate", v ? (form.tax_rate || 11) : 0)} /><div className="space-y-2"><Label>{t("settings.taxRate")}</Label><Input type="number" min="0" max="100" step="0.1" disabled={!taxOn} value={form.tax_rate} onChange={(e) => set("tax_rate", Number(e.target.value))} /><p className="text-xs text-muted-foreground">{t("settings.taxHelp")}</p></div><div className="border-t pt-4" /><SettingToggle label={t("settings.useService")} description={t("settings.serviceDescription")} checked={serviceOn} onChange={(v) => set("service_rate", v ? (form.service_rate || 5) : 0)} /><div className="space-y-2"><Label>{t("settings.serviceRate")}</Label><Input type="number" min="0" max="100" step="0.1" disabled={!serviceOn} value={form.service_rate} onChange={(e) => set("service_rate", Number(e.target.value))} /><p className="text-xs text-muted-foreground">{t("settings.serviceHelp")}</p></div><div className="border-t pt-4 space-y-2"><Label>{t("settings.rounding")}</Label><Input type="number" min="0" value={form.rounding} onChange={(e) => set("rounding", Number(e.target.value))} /><p className="text-xs text-muted-foreground">{t("settings.roundingHelp")}</p></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="size-5" />{t("settings.paymentMethods")}</CardTitle></CardHeader><CardContent className="space-y-3"><PaymentRow label={t("settings.cash")} description={t("settings.cashDescription")} checked={form.cash_enabled} onChange={(v) => set("cash_enabled", v)} /><PaymentRow label={t("settings.card")} description={t("settings.cardDescription")} checked={form.card_enabled} onChange={(v) => set("card_enabled", v)} /><PaymentRow label={t("settings.qris")} description={t("settings.qrisDescription")} checked={form.qris_enabled} onChange={(v) => set("qris_enabled", v)} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-5" />{t("settings.receiptTransactions")}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>{t("settings.transactionPrefix")}</Label><Input value={form.transaction_prefix} onChange={(e) => set("transaction_prefix", e.target.value.toUpperCase())} maxLength={8} /></div><div className="space-y-2"><Label>{t("settings.receiptNote")}</Label><Textarea value={form.receipt_note} onChange={(e) => set("receipt_note", e.target.value)} rows={2} /></div><div className="space-y-2"><Label>{t("settings.receiptFooter")}</Label><Textarea value={form.receipt_footer} onChange={(e) => set("receipt_footer", e.target.value)} rows={2} /></div></CardContent></Card>
      <PrinterSettings />
      <Card className="xl:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="size-5" />{t("settings.operations")}</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-3"><Info title={t("settings.orderNotifications")} text={t("settings.orderNotificationsText")} /><Info title={t("settings.inventory")} text={t("settings.inventoryText")} /><Info title={t("settings.qrOrdering")} text={t("settings.qrOrderingText")} /></div></CardContent></Card>
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
      <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm"><p className="font-medium">Status perangkat: Belum terhubung</p><p className="mt-1 text-muted-foreground">Saat ini konfigurasi dan template test print sudah dapat disiapkan. Pemilihan printer fisik dan cetak otomatis langsung memerlukan printer serta konektor/bridge yang sesuai dengan perangkat kasir.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={testPrint}><Printer className="mr-2 size-4" />Test print template</Button><Button onClick={saveConfig} disabled={!loaded}><Save className="mr-2 size-4" />Simpan konfigurasi printer</Button></div>
    </CardContent>
  </Card>;
}
