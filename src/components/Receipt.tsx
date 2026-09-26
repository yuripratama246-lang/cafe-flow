import { useEffect } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { rupiah, dateTimeLabel } from "@/lib/format";
import { PAYMENT_LABEL, type OrderWithItems } from "@/lib/pos";

function printReceipt() {
  const receipt = document.getElementById("receipt-area");
  if (!receipt) return;
  const printWindow = window.open("", "_blank", "width=420,height=700");
  if (!printWindow) {
    window.alert("Popup diblokir browser. Izinkan popup untuk mencetak struk.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Struk ${receipt.dataset.orderNo ?? ""}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 80mm; background: #fff; color: #000; }
  body { font: 10pt/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  #receipt-area { display: block; width: 72mm; margin: 0; padding: 4mm; color: #000; background: #fff; }
  #receipt-area * { color: #000 !important; border-color: #777 !important; }
  .text-center { text-align: center; }
  .text-base { font-size: 12pt; }
  .text-sm { font-size: 10pt; }
  .text-\[11px\] { font-size: 8pt; }
  .font-semibold { font-weight: 700; }
  .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .flex { display: flex; }
  .justify-between { justify-content: space-between; }
  .gap-2 { gap: 8px; }
  .min-w-0 { min-width: 0; }
  .flex-1 { flex: 1; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .space-y-1 > * + * { margin-top: 4px; }
  .space-y-2 > * + * { margin-top: 8px; }
  .my-3 { margin-top: 10px; margin-bottom: 10px; }
  .mt-2 { margin-top: 8px; }
  .pt-2 { padding-top: 8px; }
  .border-t { border-top: 1px solid #777; }
  .border-dashed { border-style: dashed; }
  .leading-relaxed { line-height: 1.45; }
  .no-print { display: none !important; }
  @media print { html, body { width: 80mm; } }
</style></head><body>${receipt.outerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };
}

export function Receipt({ order, autoPrint = false, onClose }: { order: OrderWithItems; autoPrint?: boolean; onClose?: () => void }) {
  useEffect(() => { if (!autoPrint) return; const timer = window.setTimeout(() => printReceipt(), 350); return () => window.clearTimeout(timer); }, [autoPrint, order.id]);
  const payment = order.payments?.[0];
  return (
    <div className="space-y-4">
      <div
        id="receipt-area"
        data-order-no={order.order_no}
        className="print-only-area mx-auto w-full max-w-xs rounded-xl border border-dashed border-border bg-card p-5 font-mono text-[13px] leading-relaxed"
      >
        <div className="text-center">
          <p className="font-display text-base font-semibold tracking-tight">KASIRKU</p>
          <p className="text-[11px] text-muted-foreground">Struk Pembayaran</p>
        </div>
        <div className="my-3 border-t border-dashed border-border" />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>No. #{order.order_no}</span>
          <span>{dateTimeLabel(order.created_at)}</span>
        </div>
        {order.restaurant_tables?.name ? (
          <p className="text-[11px] text-muted-foreground">Meja: {order.restaurant_tables.name}</p>
        ) : null}
        {order.customer_name ? (
          <p className="text-[11px] text-muted-foreground">Pelanggan: {order.customer_name}</p>
        ) : null}
        <div className="my-3 border-t border-dashed border-border" />
        <ul className="space-y-2">
          {order.order_items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">{item.product_name}</span>
                <span className="num">{rupiah(item.line_total)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {item.quantity} x {rupiah(item.unit_price)}
                {item.note ? ` · ${item.note}` : ""}
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
            <span>Total</span>
            <span className="num">{rupiah(order.total)}</span>
          </div>
          {payment ? (
            <>
              <Row label="Metode" value={PAYMENT_LABEL[payment.method] ?? payment.method} />
              {payment.cash_received != null ? (
                <Row label="Tunai" value={rupiah(payment.cash_received)} />
              ) : null}
              {payment.change_amount != null ? (
                <Row label="Kembalian" value={rupiah(payment.change_amount)} />
              ) : null}
            </>
          ) : null}
        </dl>
        <div className="my-3 border-t border-dashed border-border" />
        <p className="text-center text-[11px] text-muted-foreground">Terima kasih atas kunjungan Anda!</p>
      </div>

      <div className="no-print flex gap-2"><Button variant="outline" className="flex-1" onClick={printReceipt}>
        <Printer className="size-4" /> Cetak struk
      </Button>{onClose ? <Button variant="ghost" onClick={onClose}>Tutup</Button> : null}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
