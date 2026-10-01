import { supabase } from "@/integrations/supabase/client";

export type OfflineOrderPayload = {
  p_order: Record<string, unknown>;
  p_items: Record<string, unknown>[];
  p_payment: Record<string, unknown>;
};
type PendingOrder = { id: string; payload: OfflineOrderPayload; createdAt: string; attempts: number };
const DB_NAME = "cafe-flow-offline";
const STORE = "pendingOrders";

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline database"));
  });
}
async function putPending(item: PendingOrder): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Unable to save offline order"));
    tx.onabort = () => reject(tx.error ?? new Error("Offline save aborted"));
  });
  db.close();
}
async function getPending(): Promise<PendingOrder[]> {
  const db = await openOfflineDb();
  const rows = await new Promise<PendingOrder[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as PendingOrder[]);
    request.onerror = () => reject(request.error ?? new Error("Unable to read offline orders"));
  });
  db.close();
  return rows;
}
async function deletePending(id: string): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Unable to remove synced order"));
    tx.onabort = () => reject(tx.error ?? new Error("Offline delete aborted"));
  });
  db.close();
}

export async function queueOfflineTransaction(payload: OfflineOrderPayload): Promise<string> {
  const id = crypto.randomUUID();
  await putPending({ id, payload, createdAt: new Date().toISOString(), attempts: 0 });
  return id;
}
export async function submitPosTransaction(payload: OfflineOrderPayload) {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { queued: true as const, id: await queueOfflineTransaction(payload) };
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
    for (const item of await getPending()) {
      const { error } = await supabase.rpc("create_pos_order", {
        p_order: { ...item.payload.p_order, idempotency_key: item.id },
        p_items: item.payload.p_items, p_payment: item.payload.p_payment,
      });
      if (error) {
        await putPending({ ...item, attempts: item.attempts + 1 });
        console.error("Offline order sync failed; retained for retry", item.id, error);
        continue;
      }
      await deletePending(item.id);
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
  return () => { if (typeof window !== "undefined") window.removeEventListener("online", onOnline); };
}
