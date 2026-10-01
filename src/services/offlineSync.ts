import { openDB, type DBSchema } from "idb";
import { supabase } from "@/integrations/supabase/client";

export type OfflineOrderPayload = {
  p_order: Record<string, unknown>;
  p_items: Record<string, unknown>[];
  p_payment: Record<string, unknown>;
};
interface CafeFlowOfflineDB extends DBSchema {
  pendingOrders: { key: string; value: { id: string; payload: OfflineOrderPayload; createdAt: string; attempts: number } };
}
const DB_NAME = "cafe-flow-offline";
const STORE = "pendingOrders";
const dbPromise = openDB<CafeFlowOfflineDB>(DB_NAME, 1, {
  upgrade(db) { if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" }); },
});

export async function queueOfflineTransaction(payload: OfflineOrderPayload): Promise<string> {
  const id = crypto.randomUUID();
  const db = await dbPromise;
  await db.put(STORE, { id, payload, createdAt: new Date().toISOString(), attempts: 0 });
  return id;
}

/** Queue when offline; when online, send immediately through the same RPC contract. */
export async function submitPosTransaction(payload: OfflineOrderPayload) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { queued: true as const, id: await queueOfflineTransaction(payload) };
  }
  const { data, error } = await supabase.rpc("create_pos_order", {
    p_order: payload.p_order, p_items: payload.p_items, p_payment: payload.p_payment,
  });
  if (error) throw error;
  return { queued: false as const, data };
}

let syncing: Promise<void> | null = null;
export function syncOfflineTransactionsToServer(): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    const db = await dbPromise;
    const pending = await db.getAll(STORE);
    for (const item of pending) {
      const order = { ...item.payload.p_order, idempotency_key: item.id };
      const { error } = await supabase.rpc("create_pos_order", {
        p_order: order, p_items: item.payload.p_items, p_payment: item.payload.p_payment,
      });
      if (error) {
        await db.put(STORE, { ...item, attempts: item.attempts + 1 });
        console.error("Offline order sync failed; retained for retry", item.id, error);
        continue;
      }
      await db.delete(STORE, item.id);
    }
  })().finally(() => { syncing = null; });
  return syncing;
}

export function registerOfflineSync(): () => void {
  const onOnline = () => { void syncOfflineTransactionsToServer(); };
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    if (navigator.onLine) onOnline();
  }
  return () => window.removeEventListener("online", onOnline);
}
