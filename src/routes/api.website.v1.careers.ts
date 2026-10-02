import { createFileRoute } from "@tanstack/react-router";
import { publicGet, publicOptions, supabaseAdmin } from "@/lib/website-public-api.server";

export const Route = createFileRoute("/api/website/v1/careers")({
  server: {
    handlers: {
      GET: ({ request }) => publicGet(request, async () => {
        const { data, error } = await supabaseAdmin.from("website_careers")
          .select("id, title, department, location, employment_type, description, requirements, created_at, updated_at")
          .eq("is_active", true).order("created_at", { ascending: false });
        if (error) throw error;
        return data ?? [];
      }),
      OPTIONS: ({ request }) => publicOptions(request),
    },
  },
});
