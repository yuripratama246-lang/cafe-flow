import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ScanLine, Package, ClipboardList, QrCode, LogOut, Menu, BarChart3, Boxes, Users, Settings, ChevronDown, BadgePercent, UserCog, ShieldAlert, ShieldCheck, History, PanelLeftClose, KeyRound, Bot, Banknote } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { canAccess, useStaffProfile, type PermissionKey } from "@/lib/access";

const GROUPS: { label: string; items: { to: string; label: string; icon: typeof LayoutDashboard; permission: PermissionKey }[] }[] = [
  { label: "Utama", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" }] },
  { label: "AI", items: [{ to: "/ai", label: "AI Assistant", icon: Bot, permission: "reports" }] },
  { label: "Transaksi", items: [{ to: "/kasir", label: "Kasir", icon: ScanLine, permission: "orders" }, { to: "/pesanan", label: "Pesanan", icon: ClipboardList, permission: "orders" }, { to: "/history", label: "History", icon: History, permission: "orders" }, { to: "/shift-kasir", label: "Opening & Closing", icon: Banknote, permission: "orders" }] },
  { label: "Produk & Outlet", items: [{ to: "/produk", label: "Produk & Stok", icon: Package, permission: "products" }, { to: "/meja", label: "Meja & QR Menu", icon: QrCode, permission: "tables" }, { to: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory" }] },
  { label: "Pelanggan", items: [{ to: "/customers", label: "Pelanggan & Loyalty", icon: Users, permission: "customers" }] },
  { label: "Marketing", items: [{ to: "/promosi", label: "Promosi & Diskon", icon: BadgePercent, permission: "promotions" }] },
  { label: "Manajemen", items: [{ to: "/laporan", label: "Laporan Penjualan", icon: BarChart3, permission: "reports" }, { to: "/pegawai", label: "Pegawai & Shift", icon: UserCog, permission: "settings" }, { to: "/pengaturan", label: "Pengaturan Outlet", icon: Settings, permission: "settings" }, { to: "/api", label: "API & Integrasi", icon: KeyRound, permission: "settings" }] },
];

function NavList({ onNavigate, profile, collapsed = false, incomingCount = 0 }: { onNavigate?: () => void; profile?: ReturnType<typeof useStaffProfile>["data"]; collapsed?: boolean; incomingCount?: number }) {
  if (profile?.role === "super_admin") return <nav><div><p className={cn("mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40", collapsed && "sr-only")}>Administrator</p><div className="space-y-0.5"><Link to="/admin" onClick={onNavigate} title={collapsed ? "Manajemen Owner" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2")} activeProps={{ className: "bg-sidebar-primary/15 text-sidebar-primary hover:bg-sidebar-primary/20" }}><ShieldCheck className="size-4.5 shrink-0" /><span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>Manajemen Owner</span></Link></div></div></nav>;
  return <nav className="space-y-4">{GROUPS.map((group) => { const items = profile ? group.items.filter((item) => canAccess(profile, item.permission)) : group.items; if (!items.length) return null; return <div key={group.label}><p className={cn("mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40", collapsed && "sr-only")}>{group.label}</p><div className="space-y-0.5">{items.map(({ to, label, icon: Icon }) => { const isOrders = to === "/pesanan"; return <Link key={to} to={to} onClick={onNavigate} title={collapsed ? label : undefined} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2")} activeProps={{ className: "bg-sidebar-primary/15 text-sidebar-primary hover:bg-sidebar-primary/20" }}><Icon className="size-4.5 shrink-0" /><span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>{label}</span>{isOrders && incomingCount > 0 && <span className={cn("ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm", collapsed && "absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 text-[9px]")}>{incomingCount > 99 ? "99+" : incomingCount}</span>}</Link>; })}</div></div>; })}</nav>;
}

function Brand({ collapsed = false }: { collapsed?: boolean }) { return <div className={cn("flex items-center gap-2.5 px-3 py-1", collapsed && "justify-center px-0")}><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ScanLine className="size-5" /></div><div className={cn("leading-tight", collapsed && "hidden")}><p className="font-display text-base font-semibold text-sidebar-foreground">Cafe Flow</p><p className="text-[11px] text-sidebar-foreground/55">POS &amp; QR Ordering</p></div></div>; }
function LogoutButton({ onClick, className = "", collapsed = false }: { onClick: () => void; className?: string; collapsed?: boolean }) { return <Button variant="ghost" onClick={onClick} title={collapsed ? "Keluar" : undefined} className={cn("w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2", className)}><LogOut className="size-4.5 shrink-0" /><span className={cn(collapsed && "hidden")}>Keluar</span></Button>; }
function OutletSwitcher() { return <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs shadow-sm md:flex"><span className="size-2 rounded-full bg-emerald-500" /><span className="max-w-32 truncate font-medium">Outlet Utama</span><ChevronDown className="size-3.5 text-muted-foreground" /></div>; }

export function AppShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate(); const queryClient = useQueryClient(); const [open, setOpen] = useState(false); const [collapsed, setCollapsed] = useState(false); const staff = useStaffProfile();
  const incomingQuery = useQuery({ queryKey: ["orders", "incoming-count"], queryFn: async () => { const { count, error } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("source", "qr").eq("status", "new").eq("is_paid", false); if (error) throw error; return count ?? 0; }, enabled: !!staff.data && staff.data.role !== "super_admin" && staff.data.is_active, refetchInterval: 3000, staleTime: 1000 });
  const incomingCount = incomingQuery.data ?? 0;
  useEffect(() => { const saved = window.localStorage.getItem("cafe-flow-sidebar-collapsed"); if (saved === "1") setCollapsed(true); }, []);
  function toggleSidebar() { setCollapsed((value) => { const next = !value; window.localStorage.setItem("cafe-flow-sidebar-collapsed", next ? "1" : "0"); return next; }); }
  async function handleSignOut() { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }
  const blocked = !!staff.data && !staff.data.is_active;
  return <div className="flex min-h-screen bg-background">
    <aside className={cn("no-print sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar p-3 transition-all duration-200 lg:flex", collapsed ? "w-0 border-r-0 p-0 opacity-0" : "w-64 opacity-100")}>
      <div className="flex-1 space-y-5 overflow-y-auto pr-1"><div className="flex justify-between"><Brand /> <Button variant="ghost" size="icon" title="Sembunyikan menu" className="shrink-0" onClick={toggleSidebar}><PanelLeftClose className="size-4.5" /></Button></div>{blocked ? <Blocked /> : <NavList profile={staff.data} incomingCount={incomingCount} />}</div>
      <LogoutButton onClick={handleSignOut} />
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6">
        {collapsed && <Button variant="outline" size="icon" title="Buka menu" className="shrink-0 lg:flex" onClick={toggleSidebar}><Menu className="size-5" /></Button>}
        <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden"><Menu className="size-5" /></Button></SheetTrigger><SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-3"><SheetTitle className="sr-only">Navigasi</SheetTitle><div className="mt-6 flex h-[calc(100vh-3rem)] flex-col"><div className="flex-1 space-y-5 overflow-y-auto"><Brand />{blocked ? <Blocked /> : <NavList profile={staff.data} incomingCount={incomingCount} onNavigate={() => setOpen(false)} />}</div><LogoutButton onClick={handleSignOut} /></div></SheetContent></Sheet>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1>{description ? <p className="truncate text-xs text-muted-foreground md:text-sm">{description}</p> : null}</div>
        {staff.data?.role !== "super_admin" ? <OutletSwitcher /> : null}{actions}
      </header>
      {blocked ? <div className="m-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center"><ShieldAlert className="mx-auto mb-3 size-8 text-destructive" /><h2 className="font-semibold">Akun dinonaktifkan</h2><p className="mt-1 text-sm text-muted-foreground">Akses akun ini sudah dimatikan oleh owner. Hubungi owner untuk mengaktifkannya kembali.</p></div> : <main className="flex-1 p-4 md:p-6">{children}</main>}
    </div>
  </div>;
}
function Blocked() { return <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 text-xs text-sidebar-foreground/70"><ShieldAlert className="mb-2 size-4" /><p className="font-medium text-sidebar-foreground">Akses dinonaktifkan</p><p className="mt-1">Hubungi owner outlet.</p></div>; }
