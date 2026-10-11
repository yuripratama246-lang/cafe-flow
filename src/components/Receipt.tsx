import { useEffect } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { rupiah, dateTimeLabel } from "@/lib/format";
import { PAYMENT_LABEL, type OrderWithItems } from "@/lib/pos";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function printReceipt(order: OrderWithItems) {
  const printWindow = window.open("", "_blank", "width=420,height=700");
  if (!printWindow) {
    window.alert("Popup diblokir browser. Izinkan popup untuk mencetak struk.");
    return;
  }

  const items = order.order_items.map((item) => `
    <div class="item">
      <div class="item-head"><span class="item-name">${escapeHtml(item.product_name)}</span><strong>${escapeHtml(rupiah(item.line_total))}</strong></div>
      <div class="muted">${escapeHtml(item.quantity)} x ${escapeHtml(rupiah(item.unit_price))}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</div>
    </div>
  `).join("");

  const payment = order.payments?.[0];
  const row = (label: string, value: string) => `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
  const paymentRows = payment ? `
    ${row("Metode", PAYMENT_LABEL[payment.method] ?? payment.method)}
    ${payment.cash_received != null ? row("Tunai", rupiah(payment.cash_received)) : ""}
    ${payment.change_amount != null ? row("Kembalian", rupiah(payment.change_amount)) : ""}
  ` : "";

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Struk #${escapeHtml(order.order_no)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 80mm; background: #fff; color: #000; }
  body { font: 10pt/1.35 "Courier New", monospace; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .receipt { width: 72mm; margin: 0; padding: 3mm 2mm 5mm; overflow-wrap: anywhere; }
  .center { text-align: center; }
  .title { margin: 0; font-size: 14pt; font-weight: 700; }
  .subtitle { margin: 1mm 0 0; font-size: 9pt; }
  .rule { border: 0; border-top: 1px dashed #555; margin: 3mm 0; }
  .row, .item-head { display: flex; justify-content: space-between; gap: 3mm; }
  .row { margin: 1.5mm 0; }
  .muted { font-size: 8.5pt; white-space: normal; overflow-wrap: anywhere; }
  .item { margin: 2.5mm 0; break-inside: avoid; }
  .item-name { min-width: 0; flex: 1; overflow-wrap: anywhere; }
  .item-head strong { white-space: nowrap; }
  .total { border-top: 1px dashed #555; margin-top: 2mm; padding-top: 2mm; font-size: 12pt; font-weight: 700; }
  .thanks { margin: 3mm 0 0; text-align: center; font-size: 9pt; }
  @media screen { body { margin: 0 auto; } .receipt { margin: 0 auto; } }
</style>
</head>
<body>
  <main class="receipt">
    <header class="center"><h1 class="title">KERETA MALAM CAFE</h1><p class="subtitle">Struk Pembayaran</p></header>
    <hr class="rule">
    <div class="row"><span>No. #${escapeHtml(order.order_no)}</span><span>${escapeHtml(dateTimeLabel(order.created_at))}</span></div>
    ${order.restaurant_tables?.name ? `<div class="row"><span>Meja: ${escapeHtml(order.restaurant_tables.name)}</span></div>` : ""}
    ${order.customer_name ? `<div class="row"><span>Pelanggan: ${escapeHtml(order.customer_name)}</span></div>` : ""}
    <hr class="rule">
    ${items}
    <hr class="rule">
    ${row("Subtotal", rupiah(order.subtotal))}
    ${Number(order.discount) > 0 ? row("Diskon", `- ${rupiah(order.discount)}`) : ""}
    ${row("Pajak", rupiah(order.tax))}
    <div class="row total"><span>Total</span><span>${escapeHtml(rupiah(order.total))}</span></div>
    ${paymentRows}
    <hr class="rule">
    <p class="thanks">Terima kasih atas kunjungan Anda!</p>
  </main>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.setTimeout(() => printWindow.print(), 250);
  };
  printWindow.onafterprint = () => printWindow.close();
}

export function Receipt({ order, autoPrint = false, onClose }: { order: OrderWithItems; autoPrint?: boolean; onClose?: () => void }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => printReceipt(order), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, order]);

  const payment = order.payments?.[0];
  return (
    <div className="space-y-4">
      <div
        id="receipt-area"
        data-order-no={order.order_no}
        className="print-only-area mx-auto w-full max-w-xs rounded-xl border border-dashed border-border bg-card p-5 font-mono text-[13px] leading-relaxed"
      >
        <div className="text-center">
          <p className="font-display text-base font-semibold tracking-tight">KERETA MALAM CAFE</p>
          <p className="text-[11px] text-muted-foreground">Struk Pembayaran</p>
        </div>
        <div className="my-3 border-t border-dashed border-border" />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>No. #{order.order_no}</span>
          <span>{dateTimeLabel(order.created_at)}</span>
        </div>
        {order.restaurant_tables?.name ? <p className="text-[11px] text-muted-foreground">Meja: {order.restaurant_tables.name}</p> : null}
        {order.customer_name ? <p className="text-[11px] text-muted-foreground">Pelanggan: {order.customer_name}</p> : null}
        <div className="my-3 border-t border-dashed border-border" />
        <ul className="space-y-2">
          {order.order_items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">{item.product_name}</span>
                <span className="num">{rupiah(item.line_total)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {item.quantity} x {rupiah(item.unit_price)}{item.note ? ` · ${item.note}` : ""}
              </div>
            </li>
          ))}
        </ul>
        <div className="my-3 border-t border-dashed border-border" />
        <dl className="space-y-1">
          <Row label="Subtotal" value={rupiah(order.subtotal)} />
          {Number(order.discount) > 0 ? <Row label="Diskon" value={`- ${rupiah(order.discount)}`} /> : null}
          <Row label="Pajak" value={rupiah(order.tax)} />
          <div className="mt-2 flex justify-between border-t border-dashed border-border pt-2 text-base font-semibold">
            <span>Total</span><span className="num">{rupiah(order.total)}</span>
          </div>
          {payment ? (
            <>
              <Row label="Metode" value={PAYMENT_LABEL[payment.method] ?? payment.method} />
              {payment.cash_received != null ? <Row label="Tunai" value={rupiah(payment.cash_received)} /> : null}
              {payment.change_amount != null ? <Row label="Kembalian" value={rupiah(payment.change_amount)} /> : null}
            </>
          ) : null}
        </dl>
        <div className="my-3 border-t border-dashed border-border" />
        <p className="text-center text-[11px] text-muted-foreground">Terima kasih atas kunjungan Anda!</p>
      </div>
      <div className="no-print flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => printReceipt(order)}>
          <Printer className="size-4" /> Cetak struk
        </Button>
        {onClose ? <Button variant="ghost" onClick={onClose}>Tutup</Button> : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="num">{value}</dd></div>;
}
