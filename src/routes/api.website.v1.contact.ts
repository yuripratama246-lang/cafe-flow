import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/website/v1/contact")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const api = await import("@/lib/website-public-api.server");
        return api.publicGet(request, async () => {
        const { data, error } = await api.websiteSupabase.from("website_contacts")
          .select("id, email, phone, whatsapp, address, social_links, contact_info, updated_at")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (!data) api.resourceNotFound("Contact information");
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
