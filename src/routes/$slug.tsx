import { createFileRoute } from "@tanstack/react-router";
import { PublicWebsite } from "@/components/website/PublicWebsite";
export const Route=createFileRoute("/$slug")({ssr:false,component:()=>{const {slug}=Route.useParams();return <PublicWebsite slug={slug}/>;}});