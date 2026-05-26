import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { useAuditStore } from "@/lib/stores/audit.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { http } from "@/lib/api/axios";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";

type FieldType = "TEXT"|"TEXTAREA"|"NUMBER"|"SELECT"|"MULTISELECT"|"CHECKBOX"|"DATE"|"URL"|"EMAIL"|"PHONE";
interface FormField {
  id: string; module: string; name: string; label: string; type: FieldType;
  placeholder?: string|null; helpText?: string|null; isRequired: boolean;
  isEnabled: boolean; options?: {label:string;value:string}[]|null; order: number;
}

export const Route = createFileRoute("/_authenticated/app/audits/create")({
  head: () => ({
    meta: [
      { title: "Create Audit · 360CRD" },
      { name: "description", content: "Create a new compliance audit." },
    ],
  }),
  component: CreateAuditPage,
});

const AUDIT_TYPES = ["SCHEDULED", "UNANNOUNCED", "FOLLOW_UP", "COMPLIANCE", "INTERNAL", "EXTERNAL"];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="block px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
      {children}{required && <span className="ml-0.5 text-red-500">*</span>}
    </Label>
  );
}

function CreateAuditPage() {
  const navigate = useNavigate();
  const { createAudit } = useAuditStore();
  const { user } = useAuth();
  const canManage = user?.role === "manager" || user?.role === "tenant_admin";
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("SCHEDULED");
  const [scheduledAt, setScheduledAt] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customFields, setCustomFields] = useState<FormField[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});

  useEffect(() => {
    http.get<any>(`${ENDPOINTS.formFields.list}?module=audit&enabled=true`)
      .then((res) => setCustomFields(res.data?.data ?? []))
      .catch((err) => console.error("[FormFields] audit fetch failed", err));
  }, []);

  function handleMeta(name: string, val: unknown) {
    setMetadata((prev) => ({ ...prev, [name]: val }));
  }

  async function handleDeleteField(id: string) {
    if (!confirm("Remove this field from the form? It will be deleted for all future entries.")) return;
    try {
      await http.delete(ENDPOINTS.formFields.remove(id));
      setCustomFields((prev) => prev.filter((f) => f.id !== id));
      toast.success("Field removed");
    } catch {
      toast.error("Failed to remove field");
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createAudit({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      });
      setSuccess(true);
      setTimeout(() => navigate({ to: "/app/audits" }), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-300">
        <div>
          <Link
            to="/app/audits"
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/15 text-green-600 ring-1 ring-inset ring-green-500/25">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Audit created</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to audits list...</p>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel required>Audit Title</FieldLabel>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q2 ISO 9001 Internal Audit"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe scope, objectives, and reference standards"
                    rows={4}
                  />
                </div>

                <div>
                  <FieldLabel required>Audit Type</FieldLabel>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <FieldLabel>Scheduled Date</FieldLabel>
                  <Input
                    type="date"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Due Date</FieldLabel>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {customFields.length > 0 && (
                <div className="space-y-4 border-t border-border/40 pt-4">
                  <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Additional Fields</p>
                  {customFields.map((f) => {
                    const opts = (f.options ?? []) as { label: string; value: string }[];
                    const value = metadata[f.name];
                    const strVal = String(value ?? "");
                    const labelEl = (
                      <Label className="block px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                        {f.label}{f.isRequired && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                    );

                    let content: React.ReactNode;
                    if (f.type === "TEXTAREA") {
                      content = (<>{labelEl}<Textarea value={strVal} onChange={(e) => handleMeta(f.name, e.target.value)} placeholder={f.placeholder ?? ""} rows={3} required={f.isRequired} />{f.helpText && <p className="mt-1 px-1 text-[11px] text-muted-foreground">{f.helpText}</p>}</>);
                    } else if (f.type === "SELECT") {
                      content = (<>{labelEl}<Select value={strVal} onValueChange={(v) => handleMeta(f.name, v)}><SelectTrigger><SelectValue placeholder={f.placeholder ?? "Select…"} /></SelectTrigger><SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>{f.helpText && <p className="mt-1 px-1 text-[11px] text-muted-foreground">{f.helpText}</p>}</>);
                    } else if (f.type === "MULTISELECT") {
                      const sel: string[] = Array.isArray(value) ? (value as string[]) : [];
                      content = (<>{labelEl}<div className="space-y-1.5 rounded-lg border border-border/50 p-3">{opts.map((o) => (<label key={o.value} className="flex cursor-pointer items-center gap-2.5"><input type="checkbox" checked={sel.includes(o.value)} onChange={(e) => handleMeta(f.name, e.target.checked ? [...sel, o.value] : sel.filter((v) => v !== o.value))} className="h-4 w-4 rounded border-border accent-primary" /><span className="text-sm">{o.label}</span></label>))}</div></>);
                    } else if (f.type === "CHECKBOX") {
                      content = (<div className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3"><Switch id={f.name} checked={Boolean(value)} onCheckedChange={(v) => handleMeta(f.name, v)} /><Label htmlFor={f.name} className="cursor-pointer text-sm">{f.label}</Label></div>);
                    } else {
                      const typeMap: Record<string, string> = { DATE: "date", EMAIL: "email", PHONE: "tel", URL: "url", NUMBER: "number", TEXT: "text" };
                      content = (<>{labelEl}<Input type={typeMap[f.type] ?? "text"} value={strVal} onChange={(e) => handleMeta(f.name, e.target.value)} placeholder={f.placeholder ?? ""} required={f.isRequired} />{f.helpText && <p className="mt-1 px-1 text-[11px] text-muted-foreground">{f.helpText}</p>}</>);
                    }

                    return (
                      <div key={f.id} className="group relative">
                        {content}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDeleteField(f.id)}
                            title="Remove this field from the form"
                            className="absolute right-0 top-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-5">
                <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/audits" })}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
                >
                  <Save className="h-4 w-4" />
                  {submitting ? "Creating..." : "Create Audit"}
                </Button>
              </div>
            </form>
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}

