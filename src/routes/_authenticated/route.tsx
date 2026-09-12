import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // On a hard refresh, read the persisted browser session instead of making
    // a network-dependent getUser call. This prevents a transient auth race
    // from bubbling into the root "This page didn't load" error boundary.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
