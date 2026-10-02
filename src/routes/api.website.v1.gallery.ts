import { createFileRoute } from "@tanstack/react-router";
import { publicGet, publicOptions, websiteSupabase } from "@/lib/website-public-api.server";

export const Route = createFileRoute("/api/website/v1/gallery")({
  server: {
    handlers: {
      GET: ({ request }) => publicGet(request, async () => {
        const { data, error } = await websiteSupabase.from("website_gallery")
          .select("id, image_path, title, caption, sort_order, created_at, updated_at")
          .eq("is_active", true).order("sort_order", { ascending: true });
        if (error) throw error;
        return data ?? [];
      }),
      OPTIONS: ({ request }) => publicOptions(request),
    },
  },
});
