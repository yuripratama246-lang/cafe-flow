import { createFileRoute } from "@tanstack/react-router";
import { publicGet, publicOptions, resourceNotFound, supabaseAdmin } from "@/lib/website-public-api.server";

export const Route = createFileRoute("/api/website/v1/settings")({
  server: {
    handlers: {
      GET: ({ request }) => publicGet(request, async () => {
        const { data, error } = await supabaseAdmin.from("website_settings")
          .select("id, site_name, tagline, logo_path, favicon_path, social_links, seo_meta, branding, updated_at")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (!data) resourceNotFound("Website settings");
        return data;
      }),
      OPTIONS: ({ request }) => publicOptions(request),
    },
  },
});
