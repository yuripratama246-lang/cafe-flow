import { createFileRoute } from "@tanstack/react-router";
import { UserCog } from "lucide-react";
import { BackofficeFeaturePage } from "@/components/BackofficeFeaturePage";

export const Route = createFileRoute("/_authenticated/pegawai")({ component: PegawaiPage });

function PegawaiPage() {
  return (
    <BackofficeFeaturePage
      title="Pegawai & Shift"
      description="Kelola kasir, role, hak akses, dan shift outlet"
      icon={UserCog}
      stats={[
        { label: "Pegawai", value: "1", note: "Akun terdaftar" },
        { label: "Shift aktif", value: "1", note: "Sedang bertugas" },
        { label: "Role", value: "3", note: "Owner, manager, kasir" },
        { label: "Audit", value: "0", note: "Aktivitas hari ini" },
      ]}
      sections={[
        { title: "Akses pegawai", description: "Batasi fitur sesuai role", items: ["Owner", "Manager", "Kasir", "Hak akses custom"] },
        { title: "Shift & keamanan", description: "Pantau aktivitas operasional", items: ["Buka shift", "Tutup shift", "PIN kasir", "Riwayat aktivitas"] },
      ]}
    />
  );
}
