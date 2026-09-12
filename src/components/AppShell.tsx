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
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/kasir", label: "Kasir", icon: ScanLine },
  { to: "/pesanan", label: "Pesanan", icon: ClipboardList },
  { to: "/produk", label: "Produk", icon: Package },
  { to: "/meja", label: "QR Meja", icon: QrCode },
  { to: "/laporan", label: "Laporan", icon: ReceiptText },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{
            className: "bg-sidebar-primary/15 text-sidebar-primary hover:bg-sidebar-primary/20",
          }}
        >
          <Icon className="size-4.5" />
          {label}
        </Link>
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
        <p className="font-display text-base font-semibold text-sidebar-foreground">Kasirku</p>
        <p className="text-[11px] text-sidebar-foreground/55">POS &amp; QR Menu</p>
      </div>
    </div>
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
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <div className="space-y-6">
          <Brand />
          <NavList />
        </div>
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4.5" /> Keluar
        </Button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar p-3">
              <SheetTitle className="sr-only">Navigasi</SheetTitle>
              <div className="mt-6 space-y-6">
                <Brand />
                <NavList onNavigate={() => setOpen(false)} />
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="w-full justify-start gap-3 text-sidebar-foreground/70"
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
          {actions}
        </header>

        <main className={cn("flex-1 p-4 md:p-6")}>{children}</main>
      </div>
    </div>
  );
}
