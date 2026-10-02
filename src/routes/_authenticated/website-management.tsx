import { createFileRoute, Outlet } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/website-management" as any)({ component: () => <Outlet /> });
