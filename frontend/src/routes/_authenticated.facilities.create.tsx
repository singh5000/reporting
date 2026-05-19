import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { FacilityForm, type FacilityFormValues } from "@/components/facilities/FacilityForm";
import { facilityStore, type FacilityType } from "@/lib/facility-store";

export const Route = createFileRoute("/_authenticated/facilities/create")({
  head: () => ({
    meta: [
      { title: "Add Facility · 360CRD" },
      { name: "description", content: "Onboard a new operational facility." },
    ],
  }),
  component: CreateFacilityPage,
});

function CreateFacilityPage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: FacilityFormValues & { type: FacilityType }) => {
    await new Promise((r) => setTimeout(r, 700));
    facilityStore.addFacility({
      name: values.name,
      type: values.type,
      location: values.location,
      manager: values.manager,
      status: values.status,
      notes: values.notes,
    });
    setSuccess(true);
    setTimeout(() => navigate({ to: "/facilities" }), 900);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-300">
        <div>
          <Link
            to="/facilities"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to facilities
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Add Facility</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register a new site so it can be audited, monitored and maintained.
          </p>
        </div>

        {success ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-inset ring-success/25">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Facility added</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to facilities list…</p>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="p-6 md:p-8">
            <FacilityForm onSubmit={handleSubmit} onCancel={() => navigate({ to: "/facilities" })} />
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
