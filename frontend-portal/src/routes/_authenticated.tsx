import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authStore, useAuth } from "@/lib/auth-store";
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

    // Refresh permissions before child route guards run (navigation path)
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) { setReady(true); return; }
    // On page refresh the component renders before beforeLoad settles in some
    // React render cycles. Re-fetch permissions here and block children until
    // the store is confirmed up-to-date.
    (apiClient as any)
      .get("/auth/me")
      .then((res: any) => {
        const perms = res.data?.permissions;
        if (Array.isArray(perms)) authStore.updatePermissions(perms);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <Outlet />;
}
