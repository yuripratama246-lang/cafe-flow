import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { BackofficeFeaturePage } from "@/components/BackofficeFeaturePage";

export const Route = createFileRoute("/_authenticated/pengaturan")({ component: PengaturanPage });

function PengaturanPage() {
  return (
    <BackofficeFeaturePage
      title="Pengaturan Outlet"
      description="Atur outlet, pajak, pembayaran, struk, dan preferensi POS"
      icon={Settings}
      stats={[
        { label: "Outlet", value: "1", note: "Outlet aktif" },
        { label: "Pajak", value: "11%", note: "PPN checkout" },
        { label: "Payment", value: "3", note: "Tunai, kartu, QRIS" },
        { label: "QR Menu", value: "6", note: "Meja aktif" },
      ]}
      sections={[
        { title: "Checkout", description: "Atur aturan transaksi", items: ["Pajak & service", "Pembulatan", "Metode pembayaran", "Nomor transaksi"] },
        { title: "Outlet & struk", description: "Identitas bisnis dan tampilan nota", items: ["Profil outlet", "Alamat & kontak", "Template struk", "Catatan struk"] },
      ]}
    />
  );
}
