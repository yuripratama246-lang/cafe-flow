import { createFileRoute } from "@tanstack/react-router";
import { WebsiteNavigation } from "@/components/website/WebsiteNavigation";
export const Route=createFileRoute("/_authenticated/website-management/navigation")({component:()=> <WebsiteNavigation/>});