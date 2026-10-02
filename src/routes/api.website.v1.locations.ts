import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/locations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
        const { data, error } = await api.websiteSupabase.from("website_locations")
          .select("id, name, address, phone, contact_info, opening_hours, latitude, longitude, created_at, updated_at")
          .eq("is_active", true).order("name", { ascending: true });
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
