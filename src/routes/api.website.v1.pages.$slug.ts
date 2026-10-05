import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/pages/$slug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
          const url = new URL(request.url);
          const marker = "/api/website/v1/pages/";
          const rawSlug = url.pathname.startsWith(marker)
            ? url.pathname.slice(marker.length).split("/")[0]
            : "";
          const slug = decodeURIComponent(rawSlug).trim().toLowerCase();

          if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
            api.resourceNotFound("Website page");
          }

          const { data, error } = await api.websiteSupabase
            .from("website_pages")
            .select("id, slug, title, content, seo_meta, updated_at")
            .eq("slug", slug)
            .eq("status", "published")
            .maybeSingle();

          if (error) throw error;
          if (!data) api.resourceNotFound("Website page");
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