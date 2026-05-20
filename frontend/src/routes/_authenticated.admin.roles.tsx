import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw, ShieldCheck, Users, ChevronRight, Crown, Briefcase, HardHat, Eye } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({ meta: [{ title: "Roles Â· 360CRD" }] }),
  component: RolesPage,
});

// Each role group has its own section with description
const ROLE_GROUPS = [
  {
    key: "admin",
    label: "Administrators",
    description: "Full platform and tenant access. View everything, manage everything.",
    icon: Crown,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    slugs: ["super_admin", "tenant_admin"],
  },
  {
    key: "manager",
    label: "Manager",
    description: "Operational control over assigned sites. Creates and approves records.",
    icon: Briefcase,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    slugs: ["manager"],
  },
  {
    key: "staff",
    label: "Staff",
    description: "Task execution and own data. Reports incidents, reads training.",
    icon: HardHat,
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    slugs: ["staff"],
  },
  {
    key: "customer",
    label: "Customer",
    description: "Read-only visibility into sites, incidents, audits and reports.",
    icon: Eye,
    color: "text-gray-500",
    bg: "bg-gray-500/10",
    border: "border-gray-500/20",
    slugs: ["customer"],
  },
];

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

  // Match roles from API to groups
  function getRolesForGroup(slugs: string[]) {
    return roles.filter((r) => slugs.includes(r.slug));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Roles & Permissions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Define access levels and permission sets. Click a role to view its full permission matrix.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {ROLE_GROUPS.map((group) => {
              const groupRoles = getRolesForGroup(group.slugs);
              const Icon = group.icon;

              return (
                <div key={group.key} className={cn("rounded-xl border bg-card/50", group.border)}>
                  {/* Group header */}
                  <div className={cn("flex items-center gap-3 rounded-t-xl border-b px-5 py-4", group.border, group.bg + "/40")}>
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", group.bg)}>
                      <Icon className={cn("h-4.5 w-4.5", group.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.description}</p>
                    </div>
                  </div>

                  {/* Roles in this group */}
                  <div className="divide-y divide-border/40">
                    {groupRoles.length === 0 ? (
                      <div className="px-5 py-4 text-xs text-muted-foreground">No roles found</div>
                    ) : (
                      groupRoles.map((role) => (
                        <Link
                          key={role.id}
                          to="/roles/$id"
                          params={{ id: role.id }}
                          className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{role.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground/60">{role.slug}</span>
                              {role.isSystem && <Badge variant="secondary" className="text-[10px] px-1.5">System</Badge>}
                              {role.isDefault && <Badge variant="outline" className="text-[10px] px-1.5">Default</Badge>}
                            </div>
                            {role.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{role.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              <span>{role._count?.users ?? 0} users</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>{role.permissions?.length ?? 0} permissions</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

