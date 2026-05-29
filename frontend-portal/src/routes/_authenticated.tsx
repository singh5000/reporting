import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authStore } from "@/lib/auth-store";
import { apiClient } from "@/lib/api/api-client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    if (!authStore.getState().isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    const role = authStore.getState().user?.role ?? "";
    if (role !== "customer") {
      authStore.clear();
      throw redirect({ to: "/login" });
    }

    // Refresh permissions from backend BEFORE child beforeLoad guards run.
    try {
      const res = await (apiClient as any).get("/auth/me");
      const perms = res.data?.permissions;
      if (Array.isArray(perms)) {
        authStore.updatePermissions(perms);
      }
    } catch {
      // Fall back to cached permissions
    }

    const path = location.pathname;
    if (!path.startsWith("/portal")) {
      throw redirect({ to: "/portal/dashboard" });
    }
  },
  component: () => <Outlet />,
});
