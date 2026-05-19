import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { CompanyForm, type CompanyFormValues } from "@/components/companies/CompanyForm";
import { companyStore, type CompanyIndustry } from "@/lib/company-store";

export const Route = createFileRoute("/_authenticated/companies/create")({
  head: () => ({
    meta: [
      { title: "Add Company · 360CRD" },
      { name: "description", content: "Onboard a new tenant company." },
    ],
  }),
  component: CreateCompanyPage,
});

function CreateCompanyPage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: CompanyFormValues & { industry: CompanyIndustry }) => {
    await new Promise((r) => setTimeout(r, 700));
    companyStore.addCompany({
      name: values.name,
      industry: values.industry,
      plan: values.plan,
      status: values.status,
    });
    setSuccess(true);
    setTimeout(() => navigate({ to: "/companies" }), 900);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-300">
        <div>
          <Link
            to="/companies"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to companies
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Add Company</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Onboard a new tenant with plan, industry and initial status.
          </p>
        </div>

        {success ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-inset ring-success/25">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Company added</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to companies list…</p>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="p-6 md:p-8">
            <CompanyForm onSubmit={handleSubmit} onCancel={() => navigate({ to: "/companies" })} />
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
