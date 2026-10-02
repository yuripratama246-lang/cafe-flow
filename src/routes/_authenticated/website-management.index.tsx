import { createFileRoute } from "@tanstack/react-router";
import { WebsiteOverview } from "@/components/website/WebsiteManagement";
export const Route = createFileRoute("/_authenticated/website-management/")({ component: WebsiteOverview });
