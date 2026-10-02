import { createFileRoute } from "@tanstack/react-router";
import { WebsiteManagementPage } from "@/components/website/WebsiteManagement";
export const Route = createFileRoute("/_authenticated/website-management/locations")({ component: () => <WebsiteManagementPage kind="locations" /> });
