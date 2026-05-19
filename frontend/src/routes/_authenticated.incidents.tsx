import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { IncidentFilters } from "@/components/incidents/IncidentFilters";
import { IncidentTable } from "@/components/incidents/IncidentTable";
import { PermissionGate } from "@/components/rbac/PermissionGate";
import {
  filterIncidents,
  useIncidents,
  type IncidentFilters as TFilters,
} from "@/lib/incident-store";

export const Route = createFileRoute("/_authenticated/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents · 360CRD" },
      { name: "description", content: "Track, triage and resolve incidents across facilities." },
    ],
  }),
  component: IncidentsPage,
});

function IncidentsPage() {
  const incidents = useIncidents();
  const [filters, setFilters] = useState<TFilters>({
    search: "",
    status: "All",
    priority: "All",
    from: "",
    to: "",
  });

  const filtered = useMemo(() => filterIncidents(incidents, filters), [incidents, filters]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Incidents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track, triage and resolve operational incidents across your facilities.
            </p>
          </div>
          <PermissionGate resource="incidents" action="report">
            <Link
              to="/incidents/create"
              className="inline-flex h-10 items-center gap-2 rounded-lg [background:var(--gradient-primary)] px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Report Incident
            </Link>
          </PermissionGate>
        </div>

        <IncidentFilters value={filters} onChange={setFilters} />
        <IncidentTable data={filtered} />
      </div>
    </AppShell>
  );
}
