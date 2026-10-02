import { createFileRoute } from "@tanstack/react-router";
import { WebsiteManagementPage } from "@/components/website/WebsiteManagement";
export const Route = createFileRoute("/_authenticated/website-management/contact" as any)({ component: () => <WebsiteManagementPage kind="contact" /> });
