import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Send, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { useIncidentStore } from "@/lib/stores/incident.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/_authenticated/app/incidents/create")({
  head: () => ({
    meta: [
      { title: "Report Incident · 360CRD" },
      { name: "description", content: "Report a new operational incident." },
    ],
  }),
  component: CreateIncidentPage,
});

const INCIDENT_TYPES = [
  { value: "INCIDENT",      label: "Incident" },
  { value: "NEAR_MISS",     label: "Near Miss" },
  { value: "HAZARD",        label: "Hazard" },
  { value: "OBSERVATION",   label: "Observation" },
  { value: "ENVIRONMENTAL", label: "Environmental" },
];

const INCIDENT_CATEGORIES = [
  { value: "SAFETY",          label: "Safety" },
  { value: "ENVIRONMENTAL",   label: "Environmental" },
  { value: "QUALITY",         label: "Quality" },
  { value: "SECURITY",        label: "Security" },
  { value: "NEAR_MISS",       label: "Near Miss" },
  { value: "PROPERTY_DAMAGE", label: "Property Damage" },
  { value: "OTHER",           label: "Other" },
];

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const PRIORITY_MAP: Record<string, number> = {
  LOW: 1, MEDIUM: 3, HIGH: 4, CRITICAL: 5,
};

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "border-muted-foreground/40 text-muted-foreground",
  MEDIUM: "border-blue-500/50 text-blue-600",
  HIGH: "border-yellow-500/50 text-yellow-600",
  CRITICAL: "border-red-500/50 text-red-600",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="block px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
      {children}
    </Label>
  );
}

function CreateIncidentPage() {
  const navigate = useNavigate();
  const { createIncident } = useIncidentStore();
  const { user } = useAuth();
  const canManage = user?.role === "manager" || user?.role === "tenant_admin";
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [descError, setDescError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("INCIDENT");
  const [category, setCategory] = useState("SAFETY");
  const [severity, setSeverity] = useState("MEDIUM");
  const [priority, setPriority] = useState("MEDIUM");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [customFields, setCustomFields] = useState<FormField[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});

  useEffect(() => {
    http.get<any>(`${ENDPOINTS.formFields.list}?module=incident&enabled=true`)
      .then((res) => setCustomFields(res.data?.data ?? []))
      .catch((err) => console.error("[FormFields] incident fetch failed", err));
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
    if (description.trim().length < 10) {
      setDescError("Description must be at least 10 characters.");
      return;
    }
    setDescError("");
    setSubmitting(true);
    try {
      await createIncident({
        title: title.trim(),
        description: description.trim(),
        type,
        category,
        severity,
        priority: PRIORITY_MAP[priority],
        occurredAt: new Date(occurredAt).toISOString(),
        location: location.trim() || undefined,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      });
      setSuccess(true);
      setTimeout(() => navigate({ to: "/app/incidents" }), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-300">
        <div>
          <Link
            to="/app/incidents"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to incidents
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Report Incident</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Document what happened, classify severity, and notify the right team.
          </p>
        </div>

        {success ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/15 text-green-600 ring-1 ring-inset ring-green-500/25">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Incident reported</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to incidents list...</p>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FieldLabel>Incident Title *</FieldLabel>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief description of the incident"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Description *</FieldLabel>
                  <Textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setDescError(""); }}
                    placeholder="What happened, where and when. Include any immediate actions taken. (min. 10 characters)"
                    rows={4}
                    required
                  />
                  {descError && (
                    <p className="mt-1 px-1 text-xs text-red-500">{descError}</p>
                  )}
                </div>

                <div>
                  <FieldLabel>Incident Type *</FieldLabel>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <FieldLabel>Category *</FieldLabel>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INCIDENT_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <FieldLabel>Date &amp; Time Occurred *</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <FieldLabel>Location</FieldLabel>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Building, area or coordinates"
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Severity</FieldLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {SEVERITIES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverity(s)}
                        className={cn(
                          "h-11 rounded-xl border text-sm font-medium transition-all",
                          severity === s
                            ? cn(SEVERITY_COLOR[s], "bg-foreground/[0.03] shadow-[0_0_0_4px_color-mix(in_oklab,currentColor_12%,transparent)]")
                            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Priority</FieldLabel>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={cn(
                          "h-11 rounded-xl border text-sm font-medium transition-all",
                          priority === p
                            ? "border-primary/60 bg-primary/10 text-foreground shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_15%,transparent)]"
                            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {customFields.length > 0 && (
                <div className="md:col-span-2 space-y-4 border-t border-border/40 pt-4">
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
                <Button type="button" variant="outline" onClick={() => navigate({ to: "/app/incidents" })}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !title.trim() || description.trim().length < 10}
                  className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "Submitting..." : "Report Incident"}
                </Button>
              </div>
            </form>
          </SurfaceCard>
        )}
      </div>
    </AppShell>
  );
}
