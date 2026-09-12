import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "owner" | "manager" | "cashier";
export type PermissionKey = "dashboard" | "orders" | "payments" | "products" | "inventory" | "tables" | "reports" | "customers" | "promotions";

export type StaffProfile = {
  user_id: string;
  owner_id: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  permissions: Record<string, boolean>;
};

export async function fetchMyStaffProfile(): Promise<StaffProfile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase.from("staff_profiles").select("user_id, owner_id, full_name, role, is_active, permissions").eq("user_id", userData.user.id).maybeSingle();
  if (error) throw error;
  return (data as StaffProfile | null) ?? null;
}

export function useStaffProfile() {
  return useQuery({ queryKey: ["my-staff-profile"], queryFn: fetchMyStaffProfile, staleTime: 30_000 });
}

export function canAccess(profile: StaffProfile | null | undefined, key: PermissionKey) {
  if (!profile?.is_active) return false;
  return profile.role === "owner" || profile.permissions?.[key] === true;
}
