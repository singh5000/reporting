import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { IncidentForm, type IncidentFormValues } from "@/components/incidents/IncidentForm";
import { incidentStore } from "@/lib/incident-store";

export const Route = createFileRoute("/_authenticated/incidents/create")({
  head: () => ({
    meta: [
      { title: "Report Incident · 360CRD" },
      { name: "description", content: "Report a new operational incident." },
    ],
  }),
  component: CreateIncidentPage,
});

function CreateIncidentPage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: IncidentFormValues) => {
    await new Promise((r) => setTimeout(r, 700));
    incidentStore.addIncident(values);
    setSuccess(true);
    setTimeout(() => navigate({ to: "/incidents" }), 900);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-300">
        <div>
          <Link
            to="/incidents"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to incidents
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Report Incident</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Document what happened, classify severity, and notify the right team.
          </p>
        </div>

        {success ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-inset ring-success/25">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Incident reported</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to incidents list…</p>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="p-6 md:p-8">
            <IncidentForm onSubmit={handleSubmit} onCancel={() => navigate({ to: "/incidents" })} />
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
