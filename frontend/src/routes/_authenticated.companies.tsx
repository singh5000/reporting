import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CompanyTable } from "@/components/companies/CompanyTable";
import { useCompanies } from "@/lib/company-store";
import { PermissionGate } from "@/components/rbac/PermissionGate";
import { roleStore } from "@/lib/role-store";
import { canAccessResource } from "@/lib/rbac";

export const Route = createFileRoute("/_authenticated/companies")({
  beforeLoad: () => {
    if (!canAccessResource(roleStore.getState(), "companies")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Companies · 360CRD" },
      { name: "description", content: "Manage tenant companies, plans and users." },
    ],
  }),
  component: CompaniesPage,
});

function CompaniesPage() {
  const companies = useCompanies();
  // Trigger re-render when local state changes (placeholder for future filters).
  const [_filters] = useState({});
  void _filters;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Companies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage tenant companies, contracted plans and admin users.
            </p>
          </div>
          <PermissionGate resource="companies" action="create">
            <Link
              to="/companies/create"
              className="inline-flex h-10 items-center gap-2 rounded-lg [background:var(--gradient-primary)] px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Add Company
            </Link>
          </PermissionGate>
        </div>

        <CompanyTable data={companies} />
      </div>
    </AppShell>
  );
}
