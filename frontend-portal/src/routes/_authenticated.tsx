import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { authStore, useAuth } from "@/lib/auth-store";
import { apiClient } from "@/lib/api/api-client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    if (!authStore.getState().isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }

    const role = authStore.getState().user?.role ?? "";
    if (role !== "customer") {
      authStore.clear();
      throw redirect({ to: "/login" });
    }

    const path = location.pathname;
    if (!path.startsWith("/portal")) {
      throw redirect({ to: "/portal/dashboard" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    apiClient
      .get<{ permissions: string[] }>("/auth/me")
      .then((res: any) => {
        const perms = res.data?.permissions;
        if (Array.isArray(perms)) {
          authStore.updatePermissions(perms);
        }
      })
      .catch(() => {});
  }, []);

  return <Outlet />;
}
