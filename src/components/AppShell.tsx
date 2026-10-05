import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, LayoutDashboard, ScanLine, Package, ClipboardList, QrCode, LogOut, Menu, BarChart3, Boxes, Users, Settings, ChevronDown, BadgePercent, UserCog, ShieldAlert, ShieldCheck, History, PanelLeftClose, KeyRound, Bot, Banknote, ReceiptText, Sun, Moon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { canAccess, useStaffProfile, type PermissionKey } from "@/lib/access";
import { useTranslation } from "react-i18next";
import { globalChineseText, globalEnglishText, globalThaiText } from "@/locales/global-zh";

const ICON_TONE: Record<string, string> = {
  "/dashboard": "icon-badge-analytics",
  "/kasir": "icon-badge-transactions",
  "/pesanan": "icon-badge-transactions",
  "/history": "icon-badge-transactions",
  "/shift-kasir": "icon-badge-transactions",
  "/activity-log": "icon-badge-transactions",
  "/produk": "icon-badge-logistics",
  "/meja": "icon-badge-transactions",
  "/inventory": "icon-badge-logistics",
  "/customers": "icon-badge-transactions",
  "/promosi": "icon-badge-transactions",
  "/keuangan": "icon-badge-sales",
  "/laporan": "icon-badge-analytics",
  "/pegawai": "icon-badge-transactions",
  "/pengaturan": "icon-badge-transactions",
  "/api": "icon-badge-transactions",
  "/website-management": "icon-badge-analytics",
  "/ai": "icon-badge-analytics",
};

const GROUPS: { label: string; items: { to: string; label: string; icon: typeof LayoutDashboard; permission: PermissionKey }[] }[] = [
  { label: "main", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" }] },
  { label: "AI", items: [{ to: "/ai", label: "AI Assistant", icon: Bot, permission: "reports" }] },
  { label: "transactions", items: [{ to: "/kasir", label: "Kasir", icon: ScanLine, permission: "orders" }, { to: "/pesanan", label: "Pesanan", icon: ClipboardList, permission: "orders" }, { to: "/history", label: "History", icon: History, permission: "orders" }, { to: "/shift-kasir", label: "Opening & Closing", icon: Banknote, permission: "orders" }, { to: "/activity-log", label: "Log Aktivitas", icon: History, permission: "settings" }] },
  { label: "productOutlet", items: [{ to: "/produk", label: "Produk & Stok", icon: Package, permission: "products" }, { to: "/meja", label: "Meja & QR Menu", icon: QrCode, permission: "tables" }, { to: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory" }] },
  { label: "customers", items: [{ to: "/customers", label: "Pelanggan & Loyalty", icon: Users, permission: "customers" }] },
  { label: "marketing", items: [{ to: "/promosi", label: "Promosi & Diskon", icon: BadgePercent, permission: "promotions" }] },
  { label: "management", items: [{ to: "/keuangan", label: "Pengeluaran & Laba Rugi", icon: ReceiptText, permission: "reports" }, { to: "/laporan", label: "Laporan Penjualan", icon: BarChart3, permission: "reports" }, { to: "/pegawai", label: "Pegawai & Shift", icon: UserCog, permission: "settings" }, { to: "/pengaturan", label: "Pengaturan Outlet", icon: Settings, permission: "settings" }, { to: "/api", label: "API & Integrasi", icon: KeyRound, permission: "settings" }, { to: "/website-management", label: "Management Website", icon: Globe, permission: "settings" }] },
];

function NavList({ onNavigate, profile, collapsed = false, incomingCount = 0 }: { onNavigate?: () => void; profile?: ReturnType<typeof useStaffProfile>["data"]; collapsed?: boolean; incomingCount?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const reportsActive = location.pathname.startsWith("/laporan");
  const websiteActive = location.pathname.startsWith("/website-management");
  const [reportsOpen, setReportsOpen] = useState(reportsActive);
  const [websiteOpen, setWebsiteOpen] = useState(websiteActive);
  useEffect(() => { if (reportsActive) setReportsOpen(true); }, [reportsActive]);
  useEffect(() => { if (websiteActive) setWebsiteOpen(true); }, [websiteActive]);
  if (profile?.role === "super_admin") return <nav><div><p className={cn("mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70", collapsed && "sr-only")}>Administrator</p><div className="space-y-0.5"><Link to="/admin" onClick={onNavigate} title={collapsed ? "Manajemen Owner" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2")} activeProps={{ className: "border-l-4 border-sidebar-primary bg-sidebar-primary/15 text-sidebar-foreground hover:bg-sidebar-primary/20" }}><span className="grid size-8 shrink-0 place-items-center rounded-lg icon-badge-analytics"><ShieldCheck className="size-4" /></span><span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>Manajemen Owner</span></Link></div></div></nav>;
  return <nav className="space-y-4">{GROUPS.map((group) => { const items = profile ? group.items.filter((item) => canAccess(profile, item.permission)) : group.items; if (!items.length) return null; return <div key={group.label}><p className={cn("mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40", collapsed && "sr-only")}>{t("common." + group.label)}</p><div className="space-y-0.5">{items.map(({ to, label, icon: Icon }) => { const isOrders = to === "/pesanan"; if (to === "/laporan") return <div key={to}><button type="button" onClick={() => setReportsOpen(v => !v)} aria-expanded={reportsOpen} title={collapsed ? label : undefined} className={cn("relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", reportsActive ? "border-l-4 border-sidebar-primary bg-sidebar-primary/15 text-sidebar-foreground" : "text-sidebar-foreground/70", collapsed && "justify-center px-2")}><span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", ICON_TONE[to] ?? "icon-badge-transactions")}><Icon className="size-4" /></span><span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>{t("common.salesReports")}</span>{!collapsed && <ChevronDown className={cn("size-4 shrink-0 transition-transform", reportsOpen && "rotate-180")} />}</button>{reportsOpen && !collapsed && <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">{[{id:"summary",label:"reports.summary"},{id:"daily",label:"reports.daily"},{id:"product",label:"reports.product"},{id:"hourly",label:"reports.hourly"},{id:"payment",label:"reports.payment"},{id:"channel",label:"reports.channel"},{id:"orders",label:"reports.orderDetail"}].map(item=><a key={item.id} href={"/laporan?tab="+item.id} onClick={onNavigate} className={cn("block rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", new URLSearchParams(window.location.search).get("tab") === item.id ? "bg-sidebar-primary/10 text-sidebar-primary" : "text-sidebar-foreground/70")}>{t(item.label)}</a>)}</div>}</div>;
if (to === "/website-management") return <div key={to}><button type="button" onClick={() => collapsed ? navigate({to:"/website-management"}) : setWebsiteOpen(v => !v)} aria-expanded={websiteOpen} title={collapsed ? label : undefined} className={cn("relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", websiteActive ? "border-l-4 border-sidebar-primary bg-sidebar-primary/15 text-sidebar-foreground" : "text-sidebar-foreground/70", collapsed && "justify-center px-2")}><Icon className="size-4.5 shrink-0" /><span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>Management Website</span>{!collapsed && <ChevronDown className={cn("size-4 shrink-0 transition-transform", websiteOpen && "rotate-180")} />}</button>{websiteOpen && !collapsed && <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border pl-3"><Link to="/website-management/pages" onClick={onNavigate} className={cn("block rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", location.pathname === "/website-management/pages" ? "bg-sidebar-primary/10 text-sidebar-primary" : "text-sidebar-foreground/70")}>Website Builder</Link><Link to="/website-management/navigation" onClick={onNavigate} className={cn("block rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", location.pathname === "/website-management/navigation" ? "bg-sidebar-primary/10 text-sidebar-primary" : "text-sidebar-foreground/70")}>Menu Website</Link><Link to="/website-management/settings" onClick={onNavigate} className={cn("block rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", location.pathname === "/website-management/settings" ? "bg-sidebar-primary/10 text-sidebar-primary" : "text-sidebar-foreground/70")}>Pengaturan Website</Link></div>}</div>;
return <Link key={to} to={to} onClick={onNavigate} title={collapsed ? label : undefined} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2")} activeProps={{ className: "bg-sidebar-primary/15 text-sidebar-primary hover:bg-sidebar-primary/20" }}><Icon className="size-4.5 shrink-0" /><span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>{t("common." + ({"\/dashboard":"dashboard","\/kasir":"cashier","\/pesanan":"orders","\/history":"history","\/shift-kasir":"openingClosing","\/activity-log":"activityLog","\/produk":"productsStock","\/meja":"tablesQr","\/inventory":"inventory","\/customers":"customersLoyalty","\/promosi":"promotionsDiscounts","\/keuangan":"expensesProfit","\/laporan":"salesReports","\/pegawai":"staffShifts","\/pengaturan":"outletSettings","\/api":"apiIntegrations"}[to] || label))}</span>{isOrders && incomingCount > 0 && <span className={cn("ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm", collapsed && "absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 text-[9px]")}>{incomingCount > 99 ? "99+" : incomingCount}</span>}</Link>; })}</div></div>; })}<div className="border-t border-sidebar-border/70 pt-3"><button type="button" onClick={() => window.open("https://cafeflow.alpana1project.workers.dev/", "_blank")} title={collapsed ? "Lihat Website Kafe" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2")}><Globe className="size-4.5 shrink-0" /><span className={cn("min-w-0 flex-1 truncate", collapsed && "hidden")}>Lihat Website Kafe</span></button></div></nav>;
}

function Brand({ collapsed = false }: { collapsed?: boolean }) { return <div className={cn("flex items-center gap-2.5 px-3 py-1", collapsed && "justify-center px-0")}><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><ScanLine className="size-5" /></div><div className={cn("leading-tight", collapsed && "hidden")}><p className="font-display text-base font-semibold text-sidebar-foreground">Cafe Flow</p><p className="text-[11px] text-sidebar-foreground/55">POS &amp; QR Ordering</p></div></div>; }
function LogoutButton({ onClick, className = "", collapsed = false }: { onClick: () => void; className?: string; collapsed?: boolean }) { return <Button variant="ghost" onClick={onClick} title={collapsed ? "Keluar" : undefined} className={cn("w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center px-2", className)}><LogOut className="size-4.5 shrink-0" /><span className={cn(collapsed && "hidden")}>Keluar</span></Button>; }
function OutletSwitcher() { return <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-xs shadow-sm md:flex"><span className="size-2 rounded-full bg-emerald-500" /><span className="max-w-32 truncate font-medium">Outlet Utama</span><ChevronDown className="size-3.5 text-muted-foreground" /></div>; }

export function AppShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  const { i18n } = useTranslation();
  useEffect(() => {
    const dictionaries = { zh: globalChineseText, en: globalEnglishText, th: globalThaiText } as const;
    const reverse = new Map(Object.entries({ ...globalChineseText, ...globalEnglishText, ...globalThaiText }).map(([source, translated]) => [translated, source]));
    const dictionary = () => dictionaries[i18n.language.split("-")[0] as keyof typeof dictionaries];
    const originals = new WeakMap<Text, string>();
    const rendered = new WeakMap<Text, string>();
    const attrOriginals = new WeakMap<Element, Map<string, string>>();
    const attrRendered = new WeakMap<Element, Map<string, string>>();
    let applying = false;
    const translateText = (node: Text) => {
      const current = node.nodeValue ?? "";
      const last = rendered.get(node);
      if (last !== undefined && current !== last) originals.set(node, current);
      if (!originals.has(node)) originals.set(node, reverse.get(current.trim()) ?? current);
      const original = originals.get(node) ?? current;
      const trimmed = original.trim();
      const activeDictionary = dictionary();
      let translated = activeDictionary?.[trimmed];
      if (activeDictionary && translated === undefined && trimmed.length < 180) {
        translated = Object.entries(activeDictionary).sort((a, b) => b[0].length - a[0].length).reduce((value, [source, target]) => value.includes(source) ? value.split(source).join(target) : value, trimmed);
        if (translated === trimmed) translated = undefined;
      }
      const next = translated === undefined ? original : original.replace(trimmed, translated);
      if (current !== next) { applying = true; node.nodeValue = next; applying = false; }
      rendered.set(node, next);
    };
    const attributes = ["placeholder", "title", "aria-label", "alt"];
    const translateElement = (el: Element) => {
      let originalsForElement = attrOriginals.get(el);
      if (!originalsForElement) { originalsForElement = new Map(); attrOriginals.set(el, originalsForElement); }
      let renderedForElement = attrRendered.get(el);
      if (!renderedForElement) { renderedForElement = new Map(); attrRendered.set(el, renderedForElement); }
      for (const attr of attributes) {
        const current = el.getAttribute(attr);
        if (current === null) continue;
        const last = renderedForElement.get(attr);
        if (last !== undefined && current !== last) originalsForElement.set(attr, current);
        if (!originalsForElement.has(attr)) originalsForElement.set(attr, reverse.get(current) ?? current);
        const original = originalsForElement.get(attr) ?? current;
        const next = dictionary()?.[original] ?? original;
        if (current !== next) el.setAttribute(attr, next);
        renderedForElement.set(attr, next);
      }
    };
    const scan = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) translateText(root as Text);
      if (root instanceof Element) translateElement(root);
      root.childNodes.forEach(scan);
    };
    scan(document.body);
    const observer = new MutationObserver((records) => {
      if (applying) return;
      for (const record of records) {
        if (record.type === "characterData" && record.target instanceof Text) translateText(record.target);
        record.addedNodes.forEach(scan);
        if (record.type === "attributes" && record.target instanceof Element) translateElement(record.target);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
    const onLanguageChanged = () => scan(document.body);
    i18n.on("languageChanged", onLanguageChanged);
    return () => { observer.disconnect(); i18n.off("languageChanged", onLanguageChanged); };
  }, [i18n]);
  const navigate = useNavigate(); const queryClient = useQueryClient(); const [open, setOpen] = useState(false); const [collapsed, setCollapsed] = useState(false); const [theme, setTheme] = useState<"light" | "dark">("light"); const staff = useStaffProfile();
  const incomingQuery = useQuery({ queryKey: ["orders", "incoming-count"], queryFn: async () => { const { count, error } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("source", "qr").eq("status", "new").eq("is_paid", false); if (error) throw error; return count ?? 0; }, enabled: !!staff.data && staff.data.role !== "super_admin" && staff.data.is_active, refetchInterval: 3000, staleTime: 1000 });
  const incomingCount = incomingQuery.data ?? 0;
  useEffect(() => { const saved = window.localStorage.getItem("cafe-flow-sidebar-collapsed"); if (saved === "1") setCollapsed(true); const savedTheme = window.localStorage.getItem("cafe-flow-theme"); const nextTheme = savedTheme === "dark" ? "dark" : "light"; setTheme(nextTheme); document.documentElement.classList.toggle("dark", nextTheme === "dark"); document.documentElement.classList.toggle("light", nextTheme === "light"); document.documentElement.style.colorScheme = nextTheme; }, []);
  function toggleTheme() { const nextTheme = theme === "dark" ? "light" : "dark"; setTheme(nextTheme); window.localStorage.setItem("cafe-flow-theme", nextTheme); document.documentElement.classList.toggle("dark", nextTheme === "dark"); document.documentElement.classList.toggle("light", nextTheme === "light"); document.documentElement.style.colorScheme = nextTheme; }
  function toggleSidebar() { setCollapsed((value) => { const next = !value; window.localStorage.setItem("cafe-flow-sidebar-collapsed", next ? "1" : "0"); return next; }); }
  async function handleSignOut() { const { data: { user } } = await supabase.auth.getUser(); if (user) { const { data: profile } = await supabase.from("staff_profiles").select("owner_id").eq("user_id", user.id).maybeSingle(); await supabase.from("audit_logs").insert({ owner_id: profile?.owner_id ?? user.id, actor_user_id: user.id, action: "auth.logout", entity_type: "auth", entity_id: user.id, details: { method: "password" } }); } await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }
  const blocked = !!staff.data && !staff.data.is_active;
  return <div className="flex min-h-screen bg-transparent text-foreground transition-colors duration-200">
    <aside className={cn("no-print sticky top-0 hidden h-dvh min-h-0 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar p-3 transition-all duration-200 lg:flex", collapsed ? "w-0 border-r-0 p-0 opacity-0" : "w-64 opacity-100")}>
      <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1"><div className="flex justify-between"><Brand /> <Button variant="ghost" size="icon" title="Sembunyikan menu" className="shrink-0" onClick={toggleSidebar}><PanelLeftClose className="size-4.5" /></Button></div>{blocked ? <Blocked /> : <NavList profile={staff.data} incomingCount={incomingCount} />}</div>
      <div className="shrink-0 border-t border-sidebar-border pt-2"><LogoutButton onClick={handleSignOut} /></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6">
        {collapsed && <Button variant="outline" size="icon" title="Buka menu" className="shrink-0 lg:flex" onClick={toggleSidebar}><Menu className="size-5" /></Button>}
        <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden"><Menu className="size-5" /></Button></SheetTrigger><SheetContent side="left" className="flex h-dvh max-h-dvh w-72 flex-col overflow-hidden border-sidebar-border bg-sidebar p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"><SheetTitle className="sr-only">Navigasi</SheetTitle><div className="flex min-h-0 flex-1 flex-col pt-8"><div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain pr-1"><Brand />{blocked ? <Blocked /> : <NavList profile={staff.data} incomingCount={incomingCount} onNavigate={() => setOpen(false)} />}</div><div className="shrink-0 border-t border-sidebar-border bg-sidebar pt-2"><LogoutButton onClick={handleSignOut} /></div></div></SheetContent></Sheet>
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1>{description ? <p className="truncate text-xs text-muted-foreground md:text-sm">{description}</p> : null}</div>
        <Button type="button" variant="outline" size="sm" onClick={toggleTheme} aria-label={theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"} className="shrink-0 gap-2 rounded-xl px-2.5 sm:px-3"><Sun className="size-4 dark:hidden" /><Moon className="hidden size-4 dark:block" /><span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span></Button>
        {staff.data?.role !== "super_admin" ? <OutletSwitcher /> : null}{actions}
      </header>
      {blocked ? <div className="m-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center"><ShieldAlert className="mx-auto mb-3 size-8 text-destructive" /><h2 className="font-semibold">Akun dinonaktifkan</h2><p className="mt-1 text-sm text-muted-foreground">Akses akun ini sudah dimatikan oleh owner. Hubungi owner untuk mengaktifkannya kembali.</p></div> : <main className="min-h-0 flex-1 bg-transparent p-4 text-foreground transition-colors duration-200 md:p-6">{children}</main>}
    </div>
  </div>;
}
function Blocked() { return <div className="rounded-xl border border-border bg-muted/50 p-3 text-xs text-sidebar-foreground/70"><ShieldAlert className="mb-2 size-4" /><p className="font-medium text-sidebar-foreground">Akses dinonaktifkan</p><p className="mt-1">Hubungi owner outlet.</p></div>; }
