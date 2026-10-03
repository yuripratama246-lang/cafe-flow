import { createFileRoute } from "@tanstack/react-router";
import { PublicWebsite } from "@/components/website/PublicWebsite";
export const Route=createFileRoute("/")({ssr:false,component:()=> <PublicWebsite slug="home"/>});