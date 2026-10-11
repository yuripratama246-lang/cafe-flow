import { Capacitor } from "@capacitor/core";
import { BluetoothPrinter } from "@kduma-autoid/capacitor-bluetooth-printer";

export type PrinterRole = "kitchen" | "cashier";
export type SavedPrinter = { address: string; name: string };
export type PrinterDevice = { address: string; name: string; type: string };

const STORAGE_KEY = "kereta-malam-printer-config-v1";

export function getPrinterConfig(): Record<PrinterRole, SavedPrinter | null> {
  if (typeof window === "undefined") return { kitchen: null, cashier: null };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { kitchen: value.kitchen ?? null, cashier: value.cashier ?? null };
  } catch {
    return { kitchen: null, cashier: null };
  }
}

export function savePrinterConfig(role: PrinterRole, printer: SavedPrinter | null) {
  const current = getPrinterConfig();
  const next = { ...current, [role]: printer };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function requireNativeAndroid() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    throw new Error("Printer Bluetooth hanya tersedia di APK Android. Buka aplikasi Kereta Malam Cafe dari APK.");
  }
}

export async function listBluetoothPrinters(): Promise<PrinterDevice[]> {
  requireNativeAndroid();
  const result = await BluetoothPrinter.list();
  return (result.devices ?? []).map((device) => ({
    name: device.name || "Printer tanpa nama",
    address: device.address,
    type: String(device.type),
  })).filter((device) => Boolean(device.address));
}

function escposText(text: string) {
  // ESC/POS initialization, left alignment, UTF-8-compatible basic text, feed and cut.
  return "\x1B@\x1Ba\x00" + text.replace(/[^\x00-\x7F\n\r\t]/g, "?") + "\n\n\n\x1DVA\x00";
}

export async function testBluetoothPrinter(role: PrinterRole) {
  const printer = getPrinterConfig()[role];
  if (!printer) throw new Error(`Pilih printer ${role === "kitchen" ? "dapur" : "kasir"} terlebih dahulu.`);
  requireNativeAndroid();
  const data = escposText(
    "KERETA MALAM CAFE\n" +
    (role === "kitchen" ? "TEST TIKET DAPUR" : "TEST STRUK KASIR") +
    "\n------------------------------\n" +
    "Printer: " + printer.name + "\n" +
    "Koneksi Bluetooth OK\n" +
    new Date().toLocaleString("id-ID") + "\n"
  );
  await BluetoothPrinter.connectAndPrint({ address: printer.address, data });
}

export async function printKitchenTicket(order: {
  order_no: number | string; created_at?: string; restaurant_tables?: { name: string } | null;
  order_items: Array<{ product_name: string; quantity: number; note?: string | null }>;
  notes?: string | null;
}) {
  const printer = getPrinterConfig().kitchen;
  if (!printer) throw new Error("Printer dapur belum diatur.");
  requireNativeAndroid();
  const lines = [
    "KERETA MALAM CAFE",
    "TIKET DAPUR",
    "ORDER #" + order.order_no,
    order.restaurant_tables?.name ? "MEJA: " + order.restaurant_tables.name : "",
    order.created_at ? new Date(order.created_at).toLocaleString("id-ID") : new Date().toLocaleString("id-ID"),
    "--------------------------------",
    ...order.order_items.map((item) => `${item.quantity}x ${item.product_name}${item.note ? "\n   Catatan: " + item.note : ""}`),
    order.notes ? "CATATAN ORDER: " + order.notes : "",
    "--------------------------------",
    "Mohon segera disiapkan."
  ].filter(Boolean);
  await BluetoothPrinter.connectAndPrint({ address: printer.address, data: escposText(lines.join("\n")) });
}

export async function printCashierReceipt(order: {
  order_no: number | string; created_at?: string; subtotal: number; discount: number; tax: number; total: number;
  restaurant_tables?: { name: string } | null; customer_name?: string | null;
  order_items: Array<{ product_name: string; quantity: number; unit_price: number; line_total: number; note?: string | null }>;
  payments?: Array<{ method: string; amount: number; cash_received: number | null; change_amount: number | null }>;
}) {
  const printer = getPrinterConfig().cashier;
  if (!printer) throw new Error("Printer kasir belum diatur.");
  requireNativeAndroid();
  const money = (value: number) => "Rp" + Math.round(Number(value) || 0).toLocaleString("id-ID");
  const payment = order.payments?.[0];
  const lines = [
    "KERETA MALAM CAFE",
    "STRUK PEMBAYARAN",
    "--------------------------------",
    "Order #" + order.order_no,
    new Date(order.created_at ?? Date.now()).toLocaleString("id-ID"),
    order.restaurant_tables?.name ? "Meja: " + order.restaurant_tables.name : "",
    order.customer_name ? "Pelanggan: " + order.customer_name : "",
    "--------------------------------",
    ...order.order_items.flatMap((item) => [
      item.product_name,
      `  ${item.quantity} x ${money(item.unit_price)} = ${money(item.line_total)}`,
      item.note ? "  Catatan: " + item.note : "",
    ]).filter(Boolean),
    "--------------------------------",
    "Subtotal: " + money(order.subtotal),
    Number(order.discount) > 0 ? "Diskon: -" + money(order.discount) : "",
    "Pajak: " + money(order.tax),
    "TOTAL: " + money(order.total),
    payment ? "Pembayaran: " + payment.method : "",
    payment?.cash_received != null ? "Tunai: " + money(payment.cash_received) : "",
    payment?.change_amount != null ? "Kembalian: " + money(payment.change_amount) : "",
    "--------------------------------",
    "Terima kasih!"
  ].filter(Boolean);
  await BluetoothPrinter.connectAndPrint({ address: printer.address, data: escposText(lines.join("\n")) });
}
