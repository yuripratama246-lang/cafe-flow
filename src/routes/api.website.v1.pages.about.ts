import { createFileRoute } from "@tanstack/react-router";
import { publicGet, publicOptions, resourceNotFound, websiteSupabase } from "@/lib/website-public-api.server";

export const Route = createFileRoute("/api/website/v1/pages/about")({
  server: {
    handlers: {
      GET: ({ request }) => publicGet(request, async () => {
        const { data, error } = await websiteSupabase.from("website_pages")
          .select("id, slug, title, content, seo_meta, updated_at")
          .eq("slug", "about").eq("status", "published").maybeSingle();
        if (error) throw error;
        if (!data) resourceNotFound("About page");
        return data;
      }),
      OPTIONS: ({ request }) => publicOptions(request),
    },
  },
});
