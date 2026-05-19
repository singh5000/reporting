import { lazy, Suspense, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { KPIGrid } from "@/components/dashboard/KPIGrid";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import { dashboardStore, useDashboard } from "@/lib/dashboard-store";

const AuditTrendChart = lazy(() =>
  import("@/components/dashboard/AuditTrendChart").then((m) => ({ default: m.AuditTrendChart })),
);
const IncidentChart = lazy(() =>
  import("@/components/dashboard/IncidentChart").then((m) => ({ default: m.IncidentChart })),
);
const FacilityStatusChart = lazy(() =>
  import("@/components/dashboard/FacilityStatusChart").then((m) => ({ default: m.FacilityStatusChart })),
);

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · 360CRD" },
      { name: "description", content: "Real-time audit & compliance analytics across your facilities." },
    ],
  }),
  component: DashboardPage,
});

function ChartSkeleton() {
  return <SurfaceCard className="h-72 animate-pulse" />;
}

function DashboardPage() {
  const { metrics, auditTrend, incidentBreakdown, facilityStatus, activityLogs } = useDashboard();

  useEffect(() => {
    dashboardStore.start();
    return () => dashboardStore.stop();
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-8 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back, Elena</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Operations Overview</h1>
          </div>
          <div className="flex items-center gap-3">
            <LiveIndicator />
            <Link
              to="/audits/create"
              className="inline-flex h-10 items-center gap-2 rounded-lg [background:var(--gradient-primary)] px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> New Audit
            </Link>
          </div>
        </div>

        <KPIGrid metrics={metrics} />

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<ChartSkeleton />}>
              <AuditTrendChart data={auditTrend} />
            </Suspense>
          </div>
          <Suspense fallback={<ChartSkeleton />}>
            <FacilityStatusChart data={facilityStatus} />
          </Suspense>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<ChartSkeleton />}>
              <IncidentChart data={incidentBreakdown} />
            </Suspense>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-semibold tracking-tight">Live Activity</h2>
              <Link to="/incidents" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ActivityFeed logs={activityLogs} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
