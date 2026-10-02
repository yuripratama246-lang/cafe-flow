import { createFileRoute } from "@tanstack/react-router";
import { publicGet, publicOptions, supabaseAdmin } from "@/lib/website-public-api.server";

export const Route = createFileRoute("/api/website/v1/locations")({
  server: {
    handlers: {
      GET: ({ request }) => publicGet(request, async () => {
        const { data, error } = await supabaseAdmin.from("website_locations")
          .select("id, name, address, phone, contact_info, opening_hours, latitude, longitude, created_at, updated_at")
          .eq("is_active", true).order("name", { ascending: true });
        if (error) throw error;
        return data ?? [];
      }),
      OPTIONS: ({ request }) => publicOptions(request),
    },
  },
});
