import { createFileRoute } from "@tanstack/react-router";
import { PublicWebsite } from "@/components/website/PublicWebsite";
export const Route=createFileRoute("/about")({ssr:false,component:()=> <PublicWebsite slug="about"/>});