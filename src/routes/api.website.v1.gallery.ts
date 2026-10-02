import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/gallery")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
        const { data, error } = await api.websiteSupabase.from("website_gallery")
          .select("id, image_path, title, caption, sort_order, created_at, updated_at")
          .eq("is_active", true).order("sort_order", { ascending: true });
        if (error) throw error;
        return data ?? [];
        });
      },
      OPTIONS: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicOptions(request);
      },
    },
  },
});
