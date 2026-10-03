import { createFileRoute } from "@tanstack/react-router";
import { WebsiteBuilder } from "@/components/website/WebsiteBuilder";
export const Route=createFileRoute("/_authenticated/website-management/pages")({component:()=> <WebsiteBuilder/>});