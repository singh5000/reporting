import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  RefreshCw, ShieldCheck, Users, ChevronRight, Briefcase,
  HardHat, Eye, Plus, CheckCircle2, XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/roles/")({
  head: () => ({ meta: [{ title: "Roles · 360CRD" }] }),
  component: RolesPage,
});

// ── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_SLUGS = ["super_admin", "tenant_admin", "manager", "staff", "customer"];

const ROLE_GROUPS = [
  {
    key: "manager",
    label: "Manager",
    description: "Operational control over assigned sites. Creates and approves records.",
    icon: Briefcase,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    slugs: ["manager"],
    levelRange: [40, 69] as [number, number],
    defaultLevel: 50,
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
    levelRange: [11, 39] as [number, number],
    defaultLevel: 20,
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
    levelRange: [1, 10] as [number, number],
    defaultLevel: 10,
  },
];

const KEY_MODULES = [
  { resource: "site",     label: "Sites"    },
  { resource: "asset",    label: "Assets"   },
  { resource: "customer", label: "Customer" },
  { resource: "ppe",      label: "PPE"      },
];

const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const;
type CrudAction = typeof CRUD_ACTIONS[number];
type ModulePerms = Record<CrudAction, boolean>;
type ModulePermState = Record<string, ModulePerms>;

const emptyModulePerms = (): ModulePermState =>
  Object.fromEntries(
    KEY_MODULES.map(({ resource }) => [
      resource,
      { create: false, read: false, update: false, delete: false },
    ])
  );

const EMPTY_FORM = { name: "", description: "", baseRole: "manager" as "manager" | "staff" | "customer" };

function toSlug(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function getModuleCRUD(role: any, resource: string) {
  const rolePerms: any[] = role.permissions ?? [];
  return CRUD_ACTIONS.map((action) => ({
    action,
    letter: action[0].toUpperCase(),
    enabled: rolePerms.some((rp) => {
      const p = rp.permission ?? rp;
      return p.resource === resource && p.action === action;
    }),
  }));
}

function getPermissionIds(
  modulePerms: ModulePermState,
  allPermsGrouped: Record<string, any[]>
): string[] {
  const ids: string[] = [];
  for (const [resource, actions] of Object.entries(modulePerms)) {
    const perms = allPermsGrouped[resource] ?? [];
    for (const action of CRUD_ACTIONS) {
      if (actions[action]) {
        const perm = perms.find((p) => p.action === action);
        if (perm) ids.push(perm.id);
      }
    }
  }
  return ids;
}

// ── Component ─────────────────────────────────────────────────────────────────

function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [modulePerms, setModulePerms] = useState<ModulePermState>(emptyModulePerms());
  const [allPermsGrouped, setAllPermsGrouped] = useState<Record<string, any[]>>({});
  const [permsLoaded, setPermsLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // Load grouped permissions when drawer first opens
  useEffect(() => {
    if (drawerOpen && !permsLoaded) {
      apiClient.get<any>(ENDPOINTS.roles.permissionsGrouped)
        .then((res) => {
          setAllPermsGrouped(res.data ?? {});
          setPermsLoaded(true);
        })
        .catch(() => {});
    }
  }, [drawerOpen, permsLoaded]);

  function getRolesForGroup(group: typeof ROLE_GROUPS[0]) {
    return roles.filter(
      (r) =>
        group.slugs.includes(r.slug) ||
        (!SYSTEM_SLUGS.includes(r.slug) &&
          r.level >= group.levelRange[0] &&
          r.level <= group.levelRange[1])
    );
  }

  function toggleAction(resource: string, action: CrudAction, value: boolean) {
    setModulePerms((prev) => {
      const next = { ...prev, [resource]: { ...prev[resource], [action]: value } };
      // If enabling any write action, auto-enable read
      if (value && action !== "read") {
        next[resource].read = true;
      }
      // If disabling read, disable all actions for this module
      if (!value && action === "read") {
        next[resource] = { create: false, read: false, update: false, delete: false };
      }
      return next;
    });
  }

  function openDrawer() {
    setForm(EMPTY_FORM);
    setModulePerms(emptyModulePerms());
    setDrawerOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const level = form.baseRole === "manager" ? 50 : form.baseRole === "staff" ? 20 : 10;
      const slug = toSlug(form.name);

      const roleRes = await apiClient.post<any>(ENDPOINTS.roles.create, {
        name: form.name,
        slug,
        description: form.description || undefined,
        level,
      });

      const newRoleId = roleRes.data?.id;
      const permIds = getPermissionIds(modulePerms, allPermsGrouped);

      if (newRoleId && permIds.length > 0) {
        await apiClient.put(ENDPOINTS.roles.setPerm(newRoleId), { permissionIds: permIds });
      }

      toast.success(`Role "${form.name}" created with ${permIds.length} permissions`);
      setDrawerOpen(false);
      load();
    } catch {
      toast.error("Failed to create role");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Roles & Permissions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Define access levels and module permissions for platform users.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
              onClick={openDrawer}
            >
              <Plus className="h-4 w-4" /> New Role
            </Button>
          </div>
        </div>

        {/* Role Groups — Manager, Staff, Customer only */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {ROLE_GROUPS.map((group) => {
              const groupRoles = getRolesForGroup(group);
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

                  {/* Roles in group */}
                  <div className="divide-y divide-border/40">
                    {groupRoles.length === 0 ? (
                      <div className="px-5 py-4 text-xs text-muted-foreground">No roles found</div>
                    ) : (
                      groupRoles.map((role) => (
                        <Link
                          key={role.id}
                          to="/admin/roles/$id"
                          params={{ id: role.id }}
                          className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-accent/40 cursor-pointer"
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
                            {/* Module CRUD summary */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {KEY_MODULES.map(({ resource, label }) => {
                                const crud = getModuleCRUD(role, resource);
                                const hasAny = crud.some((p) => p.enabled);
                                return (
                                  <div
                                    key={resource}
                                    className={cn(
                                      "flex items-center gap-1 rounded-md border px-2 py-0.5",
                                      hasAny ? "border-border/50 bg-muted/30" : "border-border/20 bg-muted/10 opacity-40"
                                    )}
                                  >
                                    <span className="text-[9px] font-semibold text-muted-foreground mr-0.5">{label}</span>
                                    {crud.map(({ letter, enabled }) => (
                                      <span
                                        key={letter}
                                        className={cn(
                                          "text-[9px] font-bold w-3 text-center",
                                          enabled ? "text-primary" : "text-muted-foreground/25"
                                        )}
                                      >
                                        {letter}
                                      </span>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 mt-0.5">
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

      {/* ── New Role Drawer ── */}
      <ModuleDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="New Role"
        description="Create a role and set its module permissions"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              form="create-role-form"
              type="submit"
              disabled={submitting || !form.name}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
            >
              {submitting ? "Creating..." : "Create Role"}
            </Button>
          </div>
        }
      >
        <form id="create-role-form" onSubmit={handleCreate} className="space-y-6">

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="role-name">Role Name <span className="text-red-500">*</span></Label>
            <Input
              id="role-name"
              placeholder="e.g. Site Inspector"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            {form.name && (
              <p className="text-[11px] text-muted-foreground font-mono">
                Slug: {toSlug(form.name)}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              placeholder="Describe what this role can do..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Assign To */}
          <div className="space-y-2">
            <Label>Assign To <span className="text-red-500">*</span></Label>
            <p className="text-[11px] text-muted-foreground">Which role group does this belong to?</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_GROUPS.map((group) => {
                const Icon = group.icon;
                const selected = form.baseRole === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, baseRole: group.key as any }))}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-all",
                      selected
                        ? cn(group.bg, group.color, group.border, "ring-2 ring-offset-1 ring-offset-background", group.border.replace("border-", "ring-"))
                        : "border-border/40 text-muted-foreground hover:border-border hover:bg-muted/30"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", selected ? group.color : "text-muted-foreground")} />
                    {group.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Permissions */}
          <div className="space-y-3">
            <div>
              <Label>Module Permissions</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Select which modules this role can access and what actions they can perform.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_repeat(4,_44px)] items-center border-b border-border/60 bg-muted/20 px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Module</span>
                {CRUD_ACTIONS.map((a) => (
                  <span key={a} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {a[0].toUpperCase()}
                  </span>
                ))}
              </div>

              {/* Module rows */}
              {KEY_MODULES.map(({ resource, label }, idx) => {
                const perms = modulePerms[resource];
                const hasAny = Object.values(perms).some(Boolean);
                return (
                  <div
                    key={resource}
                    className={cn(
                      "grid grid-cols-[1fr_repeat(4,_44px)] items-center px-4 py-3",
                      idx !== KEY_MODULES.length - 1 && "border-b border-border/30",
                      hasAny ? "bg-transparent" : "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        hasAny ? "bg-primary" : "bg-muted-foreground/30"
                      )} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    {CRUD_ACTIONS.map((action) => {
                      const enabled = perms[action];
                      return (
                        <div key={action} className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => toggleAction(resource, action, !enabled)}
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-md border transition-all",
                              enabled
                                ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                : "border-border/30 bg-transparent text-muted-foreground/30 hover:border-border hover:text-muted-foreground"
                            )}
                            title={`${enabled ? "Revoke" : "Grant"} ${action} on ${label}`}
                          >
                            {enabled
                              ? <CheckCircle2 className="h-3.5 w-3.5" />
                              : <XCircle className="h-3.5 w-3.5" />
                            }
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="font-semibold">C</span> Create
              <span className="font-semibold">R</span> Read
              <span className="font-semibold">U</span> Update
              <span className="font-semibold">D</span> Delete
              <span className="ml-2 italic">Enabling C/U/D auto-enables Read</span>
            </div>
          </div>
        </form>
      </ModuleDrawer>
    </AppShell>
  );
}
