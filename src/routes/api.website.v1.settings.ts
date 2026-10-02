import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
        const { data, error } = await api.websiteSupabase.from("website_settings")
          .select("id, site_name, tagline, logo_path, favicon_path, social_links, seo_meta, branding, updated_at")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (!data) api.resourceNotFound("Website settings");
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
