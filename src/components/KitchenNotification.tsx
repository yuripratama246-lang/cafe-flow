import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type IncomingQrOrder = {
  id: string;
  order_no?: number | string | null;
  table_id?: string | null;
  customer_name?: string | null;
  source?: string | null;
};

function playNotificationBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.26);
    oscillator.onended = () => { void context.close(); };
  } catch (error) {
    console.warn("Kitchen notification audio unavailable", error);
  }
}

/** Mount once in the authenticated application shell. */
export function KitchenNotification() {
  useEffect(() => {
    const channel = supabase.channel("kitchen-qr-order-listener")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "orders", filter: "source=eq.QR_ORDER",
      }, (payload) => {
        const order = payload.new as IncomingQrOrder;
        playNotificationBeep();
        const table = order.table_id ? `Meja ${order.table_id.slice(0, 8)}` : "Meja belum ditentukan";
        toast.success("Pesanan QR baru", {
          description: `${table} • Order #${order.order_no ?? order.id.slice(0, 8)}${order.customer_name ? ` • ${order.customer_name}` : ""}`,
          duration: 8000,
        });
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.error("Kitchen QR realtime channel error");
      });
    return () => { void supabase.removeChannel(channel); };
  }, []);
  return null;
}
