import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authStore } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    if (!authStore.getState().isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    const role = authStore.getState().user?.role ?? "";
    if (role !== "customer") {
      // Wrong role for this portal — clear session and redirect to login
      authStore.clear();
      throw redirect({ to: "/login" });
    }

    const path = location.pathname;
    if (!path.startsWith("/portal")) {
      throw redirect({ to: "/portal/dashboard" });
    }
  },
  component: () => <Outlet />,
});
