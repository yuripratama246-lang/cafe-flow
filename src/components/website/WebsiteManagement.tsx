import { WebsiteBuilder } from "@/components/website/WebsiteBuilder";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";

type Kind="pages"|"gallery"|"locations"|"contact"|"careers"|"settings";
export function WebsiteManagementPage({kind}:{kind:Kind}){
 if(kind==="pages") return <WebsiteBuilder/>;
 return <AppShell title={"Management Website · "+kind} description="Kelola aset dan pengaturan website Cafe Flow"><div className="mx-auto max-w-6xl"><Card><CardContent className="p-6"><p className="text-sm text-muted-foreground">Modul ini tetap menggunakan CMS existing. Gunakan <Link className="font-semibold underline" to="/website-management/pages">Website Builder</Link> untuk menyusun halaman secara visual.</p></CardContent></Card></div></AppShell>;
}
export function WebsiteOverview(){return <WebsiteBuilder/>;}