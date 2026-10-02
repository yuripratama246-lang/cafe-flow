import { createFileRoute } from "@tanstack/react-router";
import { publicGet, publicOptions, resourceNotFound, websiteSupabase } from "@/lib/website-public-api.server";

export const Route = createFileRoute("/api/website/v1/contact")({
  server: {
    handlers: {
      GET: ({ request }) => publicGet(request, async () => {
        const { data, error } = await websiteSupabase.from("website_contacts")
          .select("id, email, phone, whatsapp, address, social_links, contact_info, updated_at")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        if (!data) resourceNotFound("Contact information");
        return data;
      }),
      OPTIONS: ({ request }) => publicOptions(request),
    },
  },
});
