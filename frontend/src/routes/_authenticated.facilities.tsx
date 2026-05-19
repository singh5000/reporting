import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { FacilityFilters } from "@/components/facilities/FacilityFilters";
import { FacilityTable } from "@/components/facilities/FacilityTable";
import { PermissionGate } from "@/components/rbac/PermissionGate";
import {
  filterFacilities,
  useFacilities,
  type FacilityFilters as TFilters,
} from "@/lib/facility-store";

export const Route = createFileRoute("/_authenticated/facilities")({
  head: () => ({
    meta: [
      { title: "Facilities · 360CRD" },
      { name: "description", content: "Operational footprint across regions and sites." },
    ],
  }),
  component: FacilitiesPage,
});

function FacilitiesPage() {
  const facilities = useFacilities();
  const [filters, setFilters] = useState<TFilters>({
    search: "",
    type: "All",
    status: "All",
  });

  const filtered = useMemo(() => filterFacilities(facilities, filters), [facilities, filters]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Facilities</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your operational footprint, sites, and maintenance posture.
            </p>
          </div>
          <PermissionGate resource="facilities" action="create">
            <Link
              to="/facilities/create"
              className="inline-flex h-10 items-center gap-2 rounded-lg [background:var(--gradient-primary)] px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Add Facility
            </Link>
          </PermissionGate>
        </div>

        <FacilityFilters value={filters} onChange={setFilters} />
        <FacilityTable data={filtered} />
      </div>
    </AppShell>
  );
}
