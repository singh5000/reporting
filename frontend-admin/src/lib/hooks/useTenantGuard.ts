import { toast } from "sonner";
import { useAuth } from "@/lib/auth-store";
import { useTenantContext } from "@/lib/stores/tenant-context.store";

export function useTenantGuard() {
  const { user } = useAuth();
  const { selectedTenantId, selectedTenantName } = useTenantContext();
  const isSuperAdmin = user?.role === "super_admin";
  const tenantMissing = isSuperAdmin && !selectedTenantId;

  function requireTenant(): boolean {
    if (tenantMissing) {
      toast.error("No company selected", {
        description: "Select a specific company from the top-left dropdown before creating records.",
      });
      return false;
    }
    return true;
  }

  return { requireTenant, isSuperAdmin, tenantMissing, selectedTenantId, selectedTenantName };
}
