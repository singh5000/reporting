import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { IncidentDetail } from "@/components/incidents/IncidentDetail";
import { useIncidents } from "@/lib/incident-store";

export const Route = createFileRoute("/_authenticated/incidents/$id")({
  head: () => ({
    meta: [
      { title: "Incident Detail · 360CRD" },
      { name: "description", content: "Incident details, timeline and actions." },
    ],
  }),
  component: IncidentDetailPage,
});

function IncidentDetailPage() {
  const { id } = Route.useParams();
  const incidents = useIncidents();
  const incident = incidents.find((i) => i.id === id);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <Link
          to="/incidents"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to incidents
        </Link>

        {incident ? (
          <IncidentDetail incident={incident} />
        ) : (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Incident not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been removed or the link is invalid.
            </p>
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
