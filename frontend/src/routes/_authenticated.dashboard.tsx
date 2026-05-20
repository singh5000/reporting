import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus, ShieldCheck, ClipboardCheck, GraduationCap, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import { useDashboardStore } from "@/lib/stores/dashboard.store";
import { useAuth } from "@/lib/auth-store";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · 360CRD" },
      { name: "description", content: "Real-time EHS & compliance analytics." },
    ],
  }),
  component: DashboardPage,
});

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <SurfaceCard className="p-5">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="mt-3 h-7 w-20" />
        <Skeleton className="mt-1.5 h-3.5 w-28" />
      </SurfaceCard>
    );
  }
  return (
    <SurfaceCard className="p-5">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground/70">{sub}</p>}
    </SurfaceCard>
  );
}

function DashboardPage() {
  const { data, loading, fetchDashboard } = useDashboardStore();
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back, {firstName}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Operations Overview</h1>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            <Link
              to="/incidents/create"
              className="inline-flex h-9 items-center gap-2 rounded-lg [background:var(--gradient-primary)] px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Report Incident
            </Link>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Open Incidents"
            value={data?.incidents.open ?? 0}
            sub={`${data?.incidents.thisMonth ?? 0} this month`}
            icon={AlertTriangle}
            color="bg-red-500/10 text-red-500"
            loading={loading && !data}
          />
          <KpiCard
            label="Compliance Score"
            value={`${data?.audits.complianceScore ?? 0}%`}
            sub={`${data?.audits.completed ?? 0} audits completed`}
            icon={ShieldCheck}
            color="bg-green-500/10 text-green-500"
            loading={loading && !data}
          />
          <KpiCard
            label="Training Completion"
            value={`${data?.training.completionRate ?? 0}%`}
            sub={`${data?.training.enrolled ?? 0} enrolled`}
            icon={GraduationCap}
            color="bg-blue-500/10 text-blue-500"
            loading={loading && !data}
          />
          <KpiCard
            label="Open CAPAs"
            value={data?.actions.openCapas ?? 0}
            sub={`${data?.actions.overdueAudits ?? 0} overdue audits`}
            icon={ClipboardCheck}
            color="bg-orange-500/10 text-orange-500"
            loading={loading && !data}
          />
        </div>

        {/* Quick action tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "View all incidents", to: "/incidents", desc: "Track and resolve safety incidents" },
            { label: "Schedule audit", to: "/audits/create", desc: "Create a new compliance audit" },
            { label: "Manage training", to: "/training", desc: "Enroll users in safety training" },
            { label: "PPE inventory", to: "/ppe", desc: "Check equipment assignments" },
            { label: "Asset register", to: "/assets", desc: "Track all company assets" },
            { label: "Run report", to: "/reports", desc: "Generate compliance reports" },
          ].map((tile) => (
            <Link
              key={tile.to}
              to={tile.to as any}
              className="group flex items-center justify-between rounded-xl border border-border/60 bg-card/50 p-4 transition-all hover:border-border hover:bg-card hover:shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary">{tile.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{tile.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>

        {/* Compliance detail */}
        {data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SurfaceCard className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Audit Compliance</h3>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Completed</span>
                  <span className="font-medium">{data.audits.completed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Passed</span>
                  <span className="font-medium text-green-500">{data.audits.passed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total</span>
                  <span className="font-medium">{data.audits.total}</span>
                </div>
              </div>
            </SurfaceCard>
            <SurfaceCard className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Training Progress</h3>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Completed</span>
                  <span className="font-medium text-green-500">{data.training.completed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Enrolled</span>
                  <span className="font-medium">{data.training.enrolled}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Completion Rate</span>
                  <span className="font-medium">{data.training.completionRate}%</span>
                </div>
              </div>
            </SurfaceCard>
            <SurfaceCard className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Outstanding Actions</h3>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Open CAPAs</span>
                  <span className="font-medium text-orange-500">{data.actions.openCapas}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Overdue Audits</span>
                  <span className="font-medium text-red-500">{data.actions.overdueAudits}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Overdue CAPAs</span>
                  <span className="font-medium text-red-500">{data.actions.overdueCapas}</span>
                </div>
              </div>
            </SurfaceCard>
          </div>
        )}
      </div>
    </AppShell>
  );
}
