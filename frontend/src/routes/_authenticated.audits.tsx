import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AuditFilters } from "@/components/audits/AuditFilters";
import { AuditTable } from "@/components/audits/AuditTable";
import { PermissionGate } from "@/components/rbac/PermissionGate";
import {
  filterAudits,
  useAudits,
  type AuditFilters as TFilters,
} from "@/lib/audit-store";

export const Route = createFileRoute("/_authenticated/audits")({
  head: () => ({
    meta: [
      { title: "Audits · 360CRD" },
      { name: "description", content: "Plan, execute and review compliance audits." },
    ],
  }),
  component: AuditsPage,
});

function AuditsPage() {
  const audits = useAudits();
  const [filters, setFilters] = useState<TFilters>({
    search: "",
    status: "All",
    assignee: "All",
    from: "",
    to: "",
  });

  const filtered = useMemo(() => filterAudits(audits, filters), [audits, filters]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Audits</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Plan, execute and review compliance audits across your organization.
            </p>
          </div>
          <PermissionGate resource="audits" action="create">
            <Link
              to="/audits/create"
              className="inline-flex h-10 items-center gap-2 rounded-lg [background:var(--gradient-primary)] px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Create Audit
            </Link>
          </PermissionGate>
        </div>

        <AuditFilters value={filters} onChange={setFilters} />
        <AuditTable data={filtered} />
      </div>
    </AppShell>
  );
}
