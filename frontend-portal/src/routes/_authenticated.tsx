import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { authStore, useAuth } from "@/lib/auth-store";
import { apiClient } from "@/lib/api/api-client";

export const Route = createFileRoute("/_authenticated")({
  // async beforeLoad: refresh permissions BEFORE child route guards run.
  // This ensures disabled modules block access on navigation.
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

    try {
      const res = await (apiClient as any).get("/auth/me");
      const perms = res.data?.permissions;
      if (Array.isArray(perms)) authStore.updatePermissions(perms);
    } catch {}

    const path = location.pathname;
    if (!path.startsWith("/portal")) {
      throw redirect({ to: "/portal/dashboard" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = useAuth();

  // On page refresh (F5), beforeLoad already ran above. But React may render
  // children with the localStorage snapshot before the store updates propagate.
  // This useEffect re-fetches once after mount to trigger a reactive re-render
  // with the latest permissions — no spinner, instant display, correct within ~100ms.
  useEffect(() => {
    if (!user) return;
    (apiClient as any)
      .get("/auth/me")
      .then((res: any) => {
        const perms = res.data?.permissions;
        if (Array.isArray(perms)) authStore.updatePermissions(perms);
      })
      .catch(() => {});
  }, []);

  return <Outlet />;
}
