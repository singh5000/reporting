import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Warehouse, ShieldAlert, ClipboardCheck, FileText, ArrowRight, Bell, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStore } from "@/lib/stores/dashboard.store";
import { useAuth, usePermissions } from "@/lib/auth-store";

export const Route = createFileRoute("/_authenticated/portal/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard · 360CRD" }] }),
  component: PortalDashboardPage,
});

function PortalDashboardPage() {
  const { data, loading, fetchDashboard } = useDashboardStore();
  const { user } = useAuth();
  const can = usePermissions();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const tiles = [
    { label: "My Sites",      to: "/portal/sites",         desc: "View assigned site status",       icon: Warehouse,    color: "bg-blue-500/10 text-blue-500",   show: can("site:read") },
    { label: "Incidents",     to: "/portal/incidents",     desc: "Track incident status",            icon: ShieldAlert,  color: "bg-red-500/10 text-red-500",     show: can("incident:read") },
    { label: "Audits",        to: "/portal/audits",        desc: "Compliance audit results",         icon: ClipboardCheck, color: "bg-green-500/10 text-green-500", show: can("audit:read") },
    { label: "Documents",     to: "/portal/documents",     desc: "Policies and SOPs",               icon: FileText,     color: "bg-purple-500/10 text-purple-500", show: can("document:read") },
    { label: "Notifications", to: "/portal/notifications", desc: "Alerts and reminders",            icon: Bell,         color: "bg-orange-500/10 text-orange-500", show: can("notification:read") },
    { label: "Feedback",      to: "/portal/feedback",      desc: "Submit queries or complaints",    icon: MessageSquare, color: "bg-gray-500/10 text-gray-500",   show: can("feedback:read") || can("feedback:create") },
  ].filter((t) => t.show);

  return (
    <AppShell>
      <div className="mx-auto max-w-[900px] space-y-8 animate-in fade-in duration-300">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back, {firstName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">My Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your site compliance and operational visibility.</p>
        </div>

        {loading && !data ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Compliance Score", value: `${data?.audits.complianceScore ?? 0}%`, color: "text-green-500" },
              { label: "Open Incidents", value: data?.incidents.open ?? 0, color: "text-red-500" },
              { label: "Completed Audits", value: data?.audits.completed ?? 0, color: "text-blue-500" },
            ].map((stat) => (
              <SurfaceCard key={stat.label} className="p-4 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </SurfaceCard>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tiles.map((tile) => (
            <Link
              key={tile.to}
              to={tile.to as any}
              className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card/50 p-4 transition-all hover:border-border hover:bg-card hover:shadow-sm"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tile.color}`}>
                <tile.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary">{tile.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{tile.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
