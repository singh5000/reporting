import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authStore } from "@/lib/auth-store";

const APP_ROLES = ["manager", "staff"];

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    if (!authStore.getState().isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    const role = authStore.getState().user?.role ?? "";
    if (!APP_ROLES.includes(role)) {
      // Wrong role for this portal — clear session and redirect to login
      authStore.clear();
      throw redirect({ to: "/login" });
    }

    const path = location.pathname;
    if (!path.startsWith("/app")) {
      throw redirect({ to: "/app/dashboard" });
    }
  },
  component: () => <Outlet />,
});
