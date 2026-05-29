import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authStore } from "@/lib/auth-store";
import { apiClient } from "@/lib/api/api-client";

const APP_ROLES = ["manager", "staff"];

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    if (!authStore.getState().isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    const role = authStore.getState().user?.role ?? "";
    if (!APP_ROLES.includes(role)) {
      authStore.clear();
      throw redirect({ to: "/login" });
    }

    // Refresh permissions from backend BEFORE child beforeLoad guards run.
    // This ensures that any super-admin permission changes are reflected
    // immediately — no re-login required.
    try {
      const res = await (apiClient as any).get("/auth/me");
      const perms = res.data?.permissions;
      if (Array.isArray(perms)) {
        authStore.updatePermissions(perms);
      }
    } catch {
      // Fall back to cached permissions — stale is better than broken auth
    }

    const path = location.pathname;
    if (!path.startsWith("/app")) {
      throw redirect({ to: "/app/dashboard" });
    }
  },
  component: () => <Outlet />,
});
