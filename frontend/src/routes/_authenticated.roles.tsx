import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/components/shared/Card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({ meta: [{ title: "Roles · 360CRD" }] }),
  component: RolesPage,
});

function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(ENDPOINTS.roles.list);
      setRoles(res.data ?? []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Roles & Permissions</h1>
            <p className="mt-1 text-sm text-muted-foreground">Define access levels and permission sets for your team.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : roles.length === 0 ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-16">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium">No roles configured</p>
          </SurfaceCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role: any) => (
              <SurfaceCard key={role.id} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-foreground">{role.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{role.slug}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {role.isSystem && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                    <span className="text-xs text-muted-foreground">L{role.level}</span>
                  </div>
                </div>
                {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-2 border-t border-border/40">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" /> {role._count?.users ?? 0} users
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> {role.permissions?.length ?? 0} permissions
                  </span>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
