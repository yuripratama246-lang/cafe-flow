import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

export function BackofficeFeaturePage({
  title,
  description,
  icon: Icon,
  stats,
  sections,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  stats: { label: string; value: string; note: string }[];
  sections: { title: string; description: string; items: string[] }[];
}) {
  return (
    <AppShell title={title} description={description}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{stat.note}</p>
                  </div>
                  <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {section.items.map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <span className="text-sm font-medium">{item}</span>
                    <Badge variant="secondary">Siap</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
