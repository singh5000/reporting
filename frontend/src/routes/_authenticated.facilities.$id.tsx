import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { FacilityDetail } from "@/components/facilities/FacilityDetail";
import { useFacilities } from "@/lib/facility-store";

export const Route = createFileRoute("/_authenticated/facilities/$id")({
  head: () => ({
    meta: [
      { title: "Facility Detail · 360CRD" },
      { name: "description", content: "Facility details and maintenance history." },
    ],
  }),
  component: FacilityDetailPage,
});

function FacilityDetailPage() {
  const { id } = Route.useParams();
  const facilities = useFacilities();
  const facility = facilities.find((f) => f.id === id);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <Link
          to="/facilities"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to facilities
        </Link>

        {facility ? (
          <FacilityDetail facility={facility} />
        ) : (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Facility not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been removed or the link is invalid.
            </p>
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
