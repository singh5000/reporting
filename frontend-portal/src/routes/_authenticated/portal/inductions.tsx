import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authStore } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated/portal/inductions")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const perms = authStore.getState().user?.permissions ?? [];
    if (!perms.includes("induction:read") && !perms.includes("*") && !perms.includes("*:*")) {
      throw redirect({ to: "/portal/dashboard" });
    }
  },
  component: () => <Outlet />,
});
