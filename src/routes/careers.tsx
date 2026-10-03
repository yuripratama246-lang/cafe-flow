import { createFileRoute } from "@tanstack/react-router";
import { PublicWebsite } from "@/components/website/PublicWebsite";
export const Route=createFileRoute("/careers")({ssr:false,component:()=> <PublicWebsite slug="careers"/>});