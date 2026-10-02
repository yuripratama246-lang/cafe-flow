import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/careers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
        const { data, error } = await api.websiteSupabase.from("website_careers")
          .select("id, title, department, location, employment_type, description, requirements, created_at, updated_at")
          .eq("is_active", true).order("created_at", { ascending: false });
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
