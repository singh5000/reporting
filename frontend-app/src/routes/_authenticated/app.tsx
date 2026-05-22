import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authStore } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: () => {
    const role = authStore.getState().user?.role ?? "";
    if (role === "customer") throw redirect({ to: "/portal/dashboard" });
    if (["super_admin", "tenant_admin"].includes(role)) throw redirect({ to: "/admin/dashboard" });
  },
  component: () => <Outlet />,
});
