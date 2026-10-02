import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/pages/about")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
        const { data, error } = await api.websiteSupabase.from("website_pages")
          .select("id, slug, title, content, seo_meta, updated_at")
          .eq("slug", "about").eq("status", "published").maybeSingle();
        if (error) throw error;
        if (!data) api.resourceNotFound("About page");
        return data;
        });
      },
      OPTIONS: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicOptions(request);
      },
    },
  },
});
