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

export function Receipt({ order, onClose }: { order: OrderWithItems; onClose?: () => void }) {
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="num">{value}</dd></div>;
}
