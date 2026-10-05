import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/pages/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
          const slug = String(params.slug ?? "").trim().toLowerCase();
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
