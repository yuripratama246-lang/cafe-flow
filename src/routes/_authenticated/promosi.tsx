import { createFileRoute } from "@tanstack/react-router";
import { BadgePercent } from "lucide-react";
import { BackofficeFeaturePage } from "@/components/BackofficeFeaturePage";

export const Route = createFileRoute("/_authenticated/promosi")({ component: PromosiPage });

function PromosiPage() {
  return (
    <BackofficeFeaturePage
      title="Promosi & Diskon"
      description="Atur promo, diskon, bundle, dan campaign penjualan"
      icon={BadgePercent}
      stats={[
        { label: "Promo aktif", value: "0", note: "Sedang berjalan" },
        { label: "Voucher", value: "0", note: "Kode tersedia" },
        { label: "Bundle", value: "0", note: "Paket menu" },
        { label: "Campaign", value: "0", note: "Campaign marketing" },
      ]}
      sections={[
        { title: "Diskon & promo", description: "Buat aturan promo yang fleksibel", items: ["Diskon persen", "Diskon nominal", "Happy hour", "Buy 1 get 1"] },
        { title: "Bundle & voucher", description: "Dorong nilai transaksi dan repeat order", items: ["Paket bundle", "Voucher kode", "Minimum pembelian", "Periode promo"] },
      ]}
    />
  );
}
