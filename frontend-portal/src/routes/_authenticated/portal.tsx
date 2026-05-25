import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authStore } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated/portal")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const role = authStore.getState().user?.role ?? "";
    if (role !== "customer") {
      throw redirect({ to: ["super_admin", "tenant_admin"].includes(role) ? "/admin/dashboard" : "/app/dashboard" });
    }
  },
  component: () => <Outlet />,
});
