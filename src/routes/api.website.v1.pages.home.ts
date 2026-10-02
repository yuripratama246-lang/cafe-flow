import { createFileRoute } from "@tanstack/react-router";
import { publicGet, publicOptions, resourceNotFound, supabaseAdmin } from "@/lib/website-public-api.server";

export const Route = createFileRoute("/api/website/v1/pages/home")({
  server: {
    handlers: {
      GET: ({ request }) => publicGet(request, async () => {
        const { data, error } = await supabaseAdmin.from("website_pages")
          .select("id, slug, title, content, seo_meta, updated_at")
          .eq("slug", "home").eq("status", "published").maybeSingle();
        if (error) throw error;
        if (!data) resourceNotFound("Home page");
        return data;
      }),
      OPTIONS: ({ request }) => publicOptions(request),
    },
  },
});
