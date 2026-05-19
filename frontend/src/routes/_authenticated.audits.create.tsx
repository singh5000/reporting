import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { AuditForm, type AuditFormValues } from "@/components/audits/AuditForm";
import { auditStore } from "@/lib/audit-store";

export const Route = createFileRoute("/_authenticated/audits/create")({
  head: () => ({
    meta: [
      { title: "Create Audit · 360CRD" },
      { name: "description", content: "Create a new compliance audit." },
    ],
  }),
  component: CreateAuditPage,
});

function CreateAuditPage() {
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: AuditFormValues) => {
    await new Promise((r) => setTimeout(r, 700));
    auditStore.addAudit({ ...values, status: "Planned" });
    setSuccess(true);
    setTimeout(() => navigate({ to: "/audits" }), 900);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-300">
        <div>
          <Link
            to="/audits"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to audits
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Create Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define scope, assign an auditor and schedule the engagement.
          </p>
        </div>

        {success ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-inset ring-success/25">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Audit created</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to audits list…</p>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="p-6 md:p-8">
            <AuditForm onSubmit={handleSubmit} onCancel={() => navigate({ to: "/audits" })} />
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
