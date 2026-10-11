import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string; sort_order: number };
export type Product = { id: string; name: string; description: string | null; price: number; image_url: string | null; category_id: string | null; stock: number; low_stock_threshold: number; menu_badge?: string | null; show_on_menu: boolean; is_active: boolean; created_at: string };
export type Promotion = { id: string; name: string; type: "percentage" | "fixed"; value: number; min_purchase: number; min_quantity?: number; scope: "cart" | "product"; product_id: string | null; starts_at: string | null; ends_at: string | null };
export type VoucherItem = { product_id: string; unit_price: number; quantity: number };
export function promotionBase(promotion: Promotion, items: VoucherItem[]) {
  return promotion.scope === "product"
    ? items.filter((item) => item.product_id === promotion.product_id).reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0)
    : items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
}
export function promotionDiscount(promotion: Promotion, items: VoucherItem[]): number | null {
  if (promotion.scope === "product" && !items.some((item) => item.product_id === promotion.product_id && item.quantity >= Number(promotion.min_quantity ?? 1))) return null;
  const base = promotionBase(promotion, items);
  if (promotion.scope === "product" && items.filter((item) => item.product_id === promotion.product_id).reduce((sum, item) => sum + item.quantity, 0) < Number(promotion.min_quantity ?? 1)) return null;
  if (base < Number(promotion.min_purchase || 0)) return null;
  return Math.min(base, promotion.type === "percentage" ? base * Number(promotion.value) / 100 : Number(promotion.value));
}
export async function fetchAvailablePromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase.rpc("get_active_public_promotions");
  if (error) throw error;
  return (data ?? []) as Promotion[];
}
export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "awaiting_confirmation" | "paid" | "rejected";
export type OrderItem = { id: string; order_id: string; product_id: string | null; product_name: string; unit_price: number; quantity: number; note: string | null; line_total: number; cost_price_snapshot?: number | null };
export type Order = { id: string; order_no: number; source: "pos" | "qr"; status: OrderStatus; table_id: string | null; customer_name: string | null; notes: string | null; subtotal: number; discount: number; tax: number; total: number; is_paid: boolean; payment_method: string | null; payment_status: PaymentStatus; created_at: string; updated_at: string };
export type OrderWithItems = Order & { order_items: OrderItem[]; payments?: { method: string; amount: number; cash_received: number | null; change_amount: number | null }[]; restaurant_tables?: { name: string } | null };
export type RestaurantTable = { id: string; name: string; code: string };
export type OutletSettings = { name: string; tax_rate: number; service_rate: number; cash_enabled: boolean; card_enabled: boolean; qris_enabled: boolean };
export type PaymentMethodConfig = { id?: string; owner_id?: string; code: string; name: string; type: "cash" | "bank_transfer" | "ewallet" | "qris" | "other"; provider: string | null; account_name: string | null; account_number: string | null; instructions: string | null; image_url: string | null; is_active?: boolean; sort_order?: number };
export const STATUS_LABEL: Record<OrderStatus, string> = { new: "Baru", preparing: "Diproses", ready: "Siap", completed: "Selesai", cancelled: "Dibatalkan" };
export const PAYMENT_LABEL: Record<string, string> = { cash: "Cash", card: "Kartu (legacy)", qris: "QRIS", unpaid: "Belum dibayar", awaiting_confirmation: "Menunggu konfirmasi", paid: "Sudah dibayar", rejected: "Ditolak" };

export async function fetchCategories(): Promise<Category[]> { const { data, error } = await supabase.from("categories").select("*").order("sort_order"); if (error) throw error; return (data ?? []) as Category[]; }
export async function fetchProducts(): Promise<Product[]> { const { data, error } = await supabase.from("products").select("*").order("name"); if (error) throw error; return (data ?? []) as unknown as Product[]; }
export async function fetchMenuProducts(): Promise<Product[]> { const { data, error } = await supabase.from("products").select("*").eq("show_on_menu", true).eq("is_active", true).order("name"); if (error) throw error; return (data ?? []) as unknown as Product[]; }
export async function fetchTables(): Promise<RestaurantTable[]> { const { data, error } = await supabase.from("restaurant_tables").select("*").order("code"); if (error) throw error; return (data ?? []) as RestaurantTable[]; }
export async function fetchPublicPaymentMethods(): Promise<PaymentMethodConfig[]> { const { data, error } = await supabase.rpc("get_public_payment_methods"); if (error) throw error; return (data ?? []) as PaymentMethodConfig[]; }
export async function fetchOutletSettings(): Promise<OutletSettings> { const { data, error } = await supabase.rpc("get_public_outlet_settings"); if (error) throw error; const row = Array.isArray(data) ? data[0] : null; return (row ?? { name: "Cafe Flow", tax_rate: 0, service_rate: 0, cash_enabled: true, card_enabled: true, qris_enabled: true }) as OutletSettings; }
export async function fetchOrders(opts?: { from?: string; to?: string; limit?: number }): Promise<OrderWithItems[]> {
 const requested=opts?.limit??1000;
 const pageSize=1000;
 const rows: unknown[]=[];
 for(let offset=0;offset<requested;offset+=pageSize){
  let query=supabase.from("orders").select("*, order_items(*), payments(method, amount, cash_received, change_amount), restaurant_tables(name)").order("created_at",{ascending:false});
  if(opts?.from) query=query.gte("created_at",opts.from);
  if(opts?.to) query=query.lte("created_at",opts.to);
  const end=Math.min(offset+pageSize,requested)-1;
  const {data,error}=await query.range(offset,end);
  if(error) throw error;
  const page=data??[];
  rows.push(...page);
  if(page.length<end-offset+1) break;
 }
 return rows as unknown as OrderWithItems[];
}
export async function fetchOrder(id: string): Promise<OrderWithItems | null> { const { data, error } = await supabase.from("orders").select("*, order_items(*), payments(method, amount, cash_received, change_amount), restaurant_tables(name)").eq("id", id).maybeSingle(); if (error) throw error; return (data ?? null) as unknown as OrderWithItems | null; }

export type NewOrderInput = { idempotency_key?: string; promotion_id?: string | null; source: "pos" | "qr"; status: OrderStatus; table_id?: string | null; customer_id?: string | null; outlet_id?: string | null; customer_name?: string | null; notes?: string | null; subtotal: number; discount: number; tax: number; total: number; is_paid: boolean; payment_method?: string | null; payment_status?: PaymentStatus; items: { product_id: string; product_name: string; unit_price: number; quantity: number; note?: string | null }[]; payment?: { method: string; amount: number; cash_received?: number | null; change_amount?: number | null } };
export async function createOrder(input: NewOrderInput): Promise<OrderWithItems> {
  const { items, payment, ...orderData } = input;

  if (input.source === "qr") {
    const { data, error } = await supabase.rpc("create_qr_order", {
      p_order: { ...orderData, source: "qr", status: "new", is_paid: false },
      p_items: items,
    });
    if (error) {
      console.error("[create_qr_order] RPC error", {
        message: error.message, code: error.code, details: error.details, hint: error.hint,
      });
      throw new Error(error.message || "Gagal membuat pesanan");
    }
    const created = (data as { order?: Order } | null)?.order;
    if (!created?.id) throw new Error("Pesanan dibuat tetapi respons order tidak valid");
    const full = await fetchOrder(created.id);
    if (!full) throw new Error("Pesanan tersimpan tetapi gagal memuat detail");
    return full;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Gagal memeriksa sesi: ${sessionError.message}`);
  if (!sessionData.session) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");

  const payload = {
    p_order: {
      ...orderData,
      idempotency_key: orderData.idempotency_key ?? crypto.randomUUID(),
      subtotal: Number(orderData.subtotal),
      discount: Number(orderData.discount),
      tax: Number(orderData.tax),
      total: Number(orderData.total),
    },
    p_items: items.map((item) => ({
      product_id: String(item.product_id),
      quantity: Number(item.quantity),
      note: item.note ?? null,
    })),
    p_payment: payment
      ? {
          method: payment.method,
          cash_received: payment.cash_received == null ? null : Number(payment.cash_received),
        }
      : null,
  };

  // Diagnostic payload: keep this immediately before the RPC call.
  console.log("[create_pos_order] payload", payload);

  try {
    const { data, error } = await supabase.rpc("create_pos_order", payload);
    if (error) {
      console.error("[create_pos_order] Supabase RPC error", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        payload,
      });
      throw new Error(`RPC create_pos_order [${error.code ?? "unknown"}]: ${error.message}${error.details ? ` | ${error.details}` : ""}${error.hint ? ` | Hint: ${error.hint}` : ""}`);
    }

    const created = (data as { order?: Order } | null)?.order;
    if (!created?.id) {
      console.error("[create_pos_order] Unexpected RPC response", data);
      throw new Error("Transaksi dibuat tetapi respons order tidak valid");
    }
    const full = await fetchOrder(created.id);
    if (!full) throw new Error("Transaksi tersimpan tetapi gagal memuat detail order");
    return full;
  } catch (error) {
    console.error("[create_pos_order] Checkout failed", error);
    throw error;
  }
}
export async function updateOrderStatus(id: string, status: OrderStatus) { const { data, error } = await supabase.from("orders").update({ status }).eq("id", id).select("id,status").maybeSingle(); if (error) throw error; if (!data) throw new Error("Status pesanan tidak berubah. Data tidak ditemukan atau akun tidak memiliki izin untuk mengubah pesanan."); return data; }
export async function approveQrOrder(id: string, cashReceived?: number | null, paymentMethod?: string): Promise<Order> { const { data, error } = await supabase.rpc("approve_qr_order_with_method", { p_order_id: id, p_payment_method: paymentMethod ?? "qris", p_cash_received: cashReceived ?? null }); if (error) throw new Error(error.message || "Gagal mengonfirmasi pembayaran"); return data as Order; }
export async function rejectQrOrder(id: string): Promise<Order> { const { data, error } = await supabase.rpc("reject_qr_order", { p_order_id: id }); if (error) throw new Error(error.message || "Gagal menolak pesanan"); return data as Order; }
