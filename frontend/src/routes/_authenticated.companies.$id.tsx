import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { CompanyDetail } from "@/components/companies/CompanyDetail";
import { useCompanies } from "@/lib/company-store";

export const Route = createFileRoute("/_authenticated/companies/$id")({
  head: () => ({
    meta: [
      { title: "Company Detail · 360CRD" },
      { name: "description", content: "Tenant company details and user management." },
    ],
  }),
  component: CompanyDetailPage,
});

function CompanyDetailPage() {
  const { id } = Route.useParams();
  const companies = useCompanies();
  const company = companies.find((c) => c.id === id);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <Link
          to="/companies"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to companies
        </Link>

        {company ? (
          <CompanyDetail company={company} />
        ) : (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border">
              <Building2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Company not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been removed or the link is invalid.
            </p>
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
