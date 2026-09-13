import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "super_admin" | "owner" | "manager" | "cashier";
export type PermissionKey = "dashboard" | "orders" | "payments" | "products" | "inventory" | "tables" | "reports" | "customers" | "promotions" | "settings";

export type StaffProfile = {
  user_id: string;
  owner_id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  permissions: Record<string, boolean>;
};

const OWNER_PERMISSIONS: Record<PermissionKey, boolean> = {
  dashboard: true, orders: true, payments: true, products: true, inventory: true,
  tables: true, reports: true, customers: true, promotions: true, settings: true,
};

export async function fetchMyStaffProfile(): Promise<StaffProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  const user = userData.user;

  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id, owner_id, full_name, role, is_active, permissions")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as StaffProfile;

  const ownerProfile = {
    user_id: user.id,
    owner_id: user.id,
    full_name: String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Owner"),
    role: "owner" as const,
    is_active: true,
    permissions: OWNER_PERMISSIONS,
  };
  const { data: inserted, error: insertError } = await supabase
    .from("staff_profiles")
    .insert(ownerProfile)
    .select("user_id, owner_id, full_name, role, is_active, permissions")
    .single();

  if (!insertError && inserted) return inserted as StaffProfile;
  if (insertError) {
    const { data: retry, error: retryError } = await supabase
      .from("staff_profiles")
      .select("user_id, owner_id, full_name, role, is_active, permissions")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!retryError && retry) return retry as StaffProfile;
    throw insertError;
  }
  return ownerProfile;
}

export function useStaffProfile() {
  return useQuery({ queryKey: ["my-staff-profile"], queryFn: fetchMyStaffProfile, staleTime: 30_000, retry: 1 });
}

export function canAccess(profile: StaffProfile | null | undefined, key: PermissionKey) {
  if (!profile?.is_active) return false;
  return profile.role === "super_admin" || profile.role === "owner" || profile.permissions?.[key] === true;
}
