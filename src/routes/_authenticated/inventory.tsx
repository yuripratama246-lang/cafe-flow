import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { BackofficeFeaturePage } from "@/components/BackofficeFeaturePage";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

function InventoryPage() {
  return (
    <BackofficeFeaturePage
      title="Inventory"
      description="Kontrol stok, bahan, supplier, dan pergerakan inventori"
      icon={Boxes}
      stats={[
        { label: "SKU aktif", value: "24", note: "Produk yang dipantau" },
        { label: "Stok menipis", value: "2", note: "Perlu restock" },
        { label: "Supplier", value: "4", note: "Supplier terdaftar" },
        { label: "Purchase order", value: "0", note: "Belum diproses" },
      ]}
      sections={[
        { title: "Manajemen stok", description: "Fitur inti inventory ala POS restoran", items: ["Stock opname", "Stock adjustment", "Stock alert", "Riwayat stok"] },
        { title: "Purchasing", description: "Siapkan alur pembelian barang", items: ["Supplier", "Purchase order", "Penerimaan barang", "Transfer antar outlet"] },
      ]}
    />
  );
}
