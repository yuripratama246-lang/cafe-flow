import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string; sort_order: number };
export type Product = { id: string; name: string; description: string | null; price: number; image_url: string | null; category_id: string | null; stock: number; low_stock_threshold: number; show_on_menu: boolean; is_active: boolean; created_at: string };
export type OrderStatus = "new" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderItem = { id: string; order_id: string; product_id: string | null; product_name: string; unit_price: number; quantity: number; note: string | null; line_total: number };
export type Order = { id: string; order_no: number; source: "pos" | "qr"; status: OrderStatus; table_id: string | null; customer_name: string | null; notes: string | null; subtotal: number; discount: number; tax: number; total: number; is_paid: boolean; created_at: string; updated_at: string };
export type OrderWithItems = Order & { order_items: OrderItem[]; payments?: { method: string; amount: number; cash_received: number | null; change_amount: number | null }[]; restaurant_tables?: { name: string } | null };
export type RestaurantTable = { id: string; name: string; code: string };
export const TAX_RATE = 0.11;
export const STATUS_LABEL: Record<OrderStatus, string> = { new: "Baru", preparing: "Diproses", ready: "Siap", completed: "Selesai", cancelled: "Dibatalkan" };
export const STATUS_FLOW: OrderStatus[] = ["new", "preparing", "ready", "completed"];
export const PAYMENT_LABEL: Record<string, string> = { cash: "Tunai", card: "Kartu", qris: "QRIS", unpaid: "Belum dibayar" };

export async function fetchCategories(): Promise<Category[]> { const { data, error } = await supabase.from("categories").select("*").order("sort_order"); if (error) throw error; return (data ?? []) as Category[]; }
export async function fetchProducts(): Promise<Product[]> { const { data, error } = await supabase.from("products").select("*").order("name"); if (error) throw error; return (data ?? []) as unknown as Product[]; }
export async function fetchMenuProducts(): Promise<Product[]> { const { data, error } = await supabase.from("products").select("*").eq("show_on_menu", true).eq("is_active", true).order("name"); if (error) throw error; return (data ?? []) as unknown as Product[]; }
export async function fetchTables(): Promise<RestaurantTable[]> { const { data, error } = await supabase.from("restaurant_tables").select("*").order("code"); if (error) throw error; return (data ?? []) as RestaurantTable[]; }
export async function fetchOrders(opts?: { from?: string; to?: string; limit?: number }): Promise<OrderWithItems[]> { let query = supabase.from("orders").select("*, order_items(*), payments(method, amount, cash_received, change_amount), restaurant_tables(name)").order("created_at", { ascending: false }); if (opts?.from) query = query.gte("created_at", opts.from); if (opts?.to) query = query.lte("created_at", opts.to); if (opts?.limit) query = query.limit(opts.limit); const { data, error } = await query; if (error) throw error; return (data ?? []) as unknown as OrderWithItems[]; }
export async function fetchOrder(id: string): Promise<OrderWithItems | null> { const { data, error } = await supabase.from("orders").select("*, order_items(*), restaurant_tables(name)").eq("id", id).maybeSingle(); if (error) throw error; return (data ?? null) as unknown as OrderWithItems | null; }

export type NewOrderInput = { source: "pos" | "qr"; status: OrderStatus; table_id?: string | null; customer_name?: string | null; notes?: string | null; subtotal: number; discount: number; tax: number; total: number; is_paid: boolean; items: { product_id: string; product_name: string; unit_price: number; quantity: number; note?: string | null }[]; payment?: { method: "cash" | "card" | "qris"; amount: number; cash_received?: number | null; change_amount?: number | null } };

export async function createOrder(input: NewOrderInput): Promise<OrderWithItems> {
  const { items, payment, ...orderData } = input;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");

  // POS checkout is performed atomically inside Supabase. The database creates
  // the order, child items and payment first, then marks it completed/paid.
  // This guarantees Google Sheets sees the complete sale instead of an order
  // row without its items/payment.
  const { data, error } = await supabase.rpc("create_pos_order", {
    p_order: orderData,
    p_items: items,
    p_payment: payment ?? null,
  });
  if (error) throw new Error(error.message || "Gagal menyimpan transaksi");

  const created = (data as { order?: Order } | null)?.order;
  if (!created?.id) throw new Error("Transaksi dibuat tetapi respons order tidak valid");

  const full = await fetchOrder(created.id);
  if (!full) throw new Error("Transaksi tersimpan tetapi gagal memuat detail order");
  return full;
}

export async function updateOrderStatus(id: string, status: OrderStatus) { const { error } = await supabase.from("orders").update({ status }).eq("id", id); if (error) throw error; }
