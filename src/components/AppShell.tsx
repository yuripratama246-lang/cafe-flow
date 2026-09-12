import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ScanLine,
  Package,
  ReceiptText,
  ClipboardList,
  QrCode,
  LogOut,
  Menu,
  BarChart3,
  Boxes,
  Users,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Utama",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Transaksi",
    items: [
      { to: "/kasir", label: "Kasir", icon: ScanLine },
      { to: "/pesanan", label: "Pesanan", icon: ClipboardList },
    ],
  },
  {
    label: "Produk & Inventori",
    items: [
      { to: "/produk", label: "Produk & Stok", icon: Package },
      { to: "/meja", label: "Meja & QR Menu", icon: QrCode },
    ],
  },
  {
    label: "Analitik",
    items: [
      { to: "/laporan", label: "Laporan Penjualan", icon: BarChart3 },
    ],
  },
  {
    label: "Segera Hadir",
    items: [
      { to: "/dashboard", label: "Inventory & Supplier", icon: Boxes },
      { to: "/dashboard", label: "Pelanggan & Loyalty", icon: Users },
      { to: "/dashboard", label: "Pengaturan Outlet", icon: Settings },
    ],
  },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon }, index) => {
              const upcoming = group.label === "Segera Hadir";
              return (
                <Link
                  key={`${label}-${index}`}
                  to={to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    upcoming && "opacity-55",
                  )}
                  activeProps={{
                    className: "bg-sidebar-primary/15 text-sidebar-primary hover:bg-sidebar-primary/20",
                  }}
                >
                  <Icon className="size-4.5" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {upcoming ? <span className="text-[9px]">soon</span> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-1">
      <div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <ScanLine className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-base font-semibold text-sidebar-foreground">Cafe Flow</p>
        <p className="text-[11px] text-sidebar-foreground/55">POS &amp; QR Ordering</p>
      </div>
    </div>
  );
}

function OutletSwitcher() {
  return (
    <button className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs shadow-sm md:flex">
      <span className="size-2 rounded-full bg-emerald-500" />
      <span className="max-w-32 truncate font-medium">Outlet Utama</span>
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </button>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <div className="space-y-5 overflow-y-auto pr-1">
          <Brand />
          <NavList />
        </div>
        <div className="pt-3">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4.5" /> Keluar
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-3">
              <SheetTitle className="sr-only">Navigasi</SheetTitle>
              <div className="mt-6 flex h-[calc(100vh-3rem)] flex-col">
                <div className="flex-1 space-y-6 overflow-y-auto">
                  <Brand />
                  <NavList onNavigate={() => setOpen(false)} />
                </div>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="mt-4 w-full justify-start gap-3 text-sidebar-foreground/70"
                >
                  <LogOut className="size-4.5" /> Keluar
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1>
            {description ? (
              <p className="truncate text-xs text-muted-foreground md:text-sm">{description}</p>
            ) : null}
          </div>
          <OutletSwitcher />
          {actions}
        </header>

        <main className={cn("flex-1 p-4 md:p-6")}>{children}</main>
      </div>
    </div>
  );
}
