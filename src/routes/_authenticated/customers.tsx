import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { BackofficeFeaturePage } from "@/components/BackofficeFeaturePage";

export const Route = createFileRoute("/_authenticated/customers")({ component: CustomersPage });

function CustomersPage() {
  return (
    <BackofficeFeaturePage
      title="Pelanggan & Loyalty"
      description="Kelola pelanggan, riwayat pembelian, dan program loyalty"
      icon={Users}
      stats={[
        { label: "Pelanggan", value: "0", note: "Database pelanggan" },
        { label: "Member aktif", value: "0", note: "Program loyalty" },
        { label: "Repeat customer", value: "0%", note: "Bisa dianalisis dari transaksi" },
        { label: "Feedback", value: "0", note: "Masukan pelanggan" },
      ]}
      sections={[
        { title: "CRM", description: "Bangun database pelanggan dari transaksi", items: ["Profil pelanggan", "Riwayat pembelian", "Catatan pelanggan", "Feedback & survey"] },
        { title: "Loyalty", description: "Siapkan program retensi pelanggan", items: ["Member", "Poin reward", "Voucher", "Promo pelanggan"] },
      ]}
    />
  );
}
