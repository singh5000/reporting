import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Plus, RefreshCw, ClipboardCheck, ChevronRight,
  CheckCircle2, Clock, AlertTriangle, BarChart3, Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuditStore } from "@/lib/stores/audit.store";
import { auditService, type CreateAuditPayload } from "@/lib/api/services/audit.service";
import { usePermissions, useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FilterBar } from "@/components/shared/FilterBar";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { cn } from "@/lib/utils";
import { http } from "@/lib/api/axios";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { toast } from "sonner";

type FieldType = "TEXT"|"TEXTAREA"|"NUMBER"|"SELECT"|"MULTISELECT"|"CHECKBOX"|"DATE"|"URL"|"EMAIL"|"PHONE";
interface FormField {
  id: string; module: string; name: string; label: string; type: FieldType;
  placeholder?: string|null; helpText?: string|null; isRequired: boolean;
  isEnabled: boolean; options?: {label:string;value:string}[]|null; order: number;
}

export const Route = createFileRoute("/_authenticated/app/audits/")({
  head: () => ({
    meta: [
      { title: "Audits · 360CRD" },
      { name: "description", content: "Plan, execute and review compliance audits." },
    ],
  }),
  component: AuditsPage,
});

const STATUS_COLOR: Record<string, string> = {
  DRAFT:       "bg-gray-500/10 text-gray-600 border-gray-500/20",
  SCHEDULED:   "bg-blue-500/10 text-blue-600 border-blue-500/20",
  IN_PROGRESS: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  COMPLETED:   "bg-green-500/10 text-green-600 border-green-500/20",
  REVIEWED:    "bg-purple-500/10 text-purple-600 border-purple-500/20",
  CANCELLED:   "bg-red-500/10 text-red-600 border-red-500/20",
};

const AUDIT_TYPES = [
  "SCHEDULED", "UNANNOUNCED", "FOLLOW_UP", "COMPLIANCE", "INTERNAL", "EXTERNAL",
];

const FILTER_CONFIGS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "DRAFT", label: "Draft" },
      { value: "SCHEDULED", label: "Scheduled" },
      { value: "IN_PROGRESS", label: "In Progress" },
      { value: "COMPLETED", label: "Completed" },
      { value: "REVIEWED", label: "Reviewed" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
  },
  {
    key: "type",
    label: "Type",
    options: AUDIT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") })),
  },
];

const EMPTY_FORM: CreateAuditPayload = {
  title: "",
  description: "",
  type: "SCHEDULED",
  scheduledAt: "",
  dueDate: "",
};

function AuditsPage() {
  const { audits, loading, initialized, fetchAudits, createAudit } = useAuditStore();
  const can = usePermissions();
  const { user } = useAuth();
  const canManage = user?.role === "manager" || user?.role === "tenant_admin";
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<CreateAuditPayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [customFields, setCustomFields] = useState<FormField[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetchAudits();
    auditService.stats().then(setStats).catch(() => {});
  }, [initialized, fetchAudits]);

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return audits.filter((a) => {
      if (q && !a.title.toLowerCase().includes(q) && !a.refNumber.toLowerCase().includes(q)) return false;
      if (filterVals.status && filterVals.status !== "ALL" && a.status !== filterVals.status) return false;
      if (filterVals.type && filterVals.type !== "ALL" && a.type !== filterVals.type) return false;
      return true;
    });
  }, [audits, search, filterVals]);

  const pills = [
    { label: "Total", value: stats?.total ?? audits.length, icon: ClipboardCheck, color: "text-foreground" },
    { label: "Completed", value: stats?.completed ?? audits.filter((a) => a.status === "COMPLETED").length, icon: CheckCircle2, color: "text-green-500" },
    { label: "In Progress", value: audits.filter((a) => a.status === "IN_PROGRESS").length, icon: Clock, color: "text-yellow-500" },
    { label: "Overdue", value: stats?.overdue ?? 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "Avg Score", value: stats?.avgScore ? `${stats.avgScore.toFixed(0)}%` : "—", icon: BarChart3, color: "text-primary" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAudit({
        ...form,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      });
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      setMetadata({});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Audits</h1>
            <p className="mt-1 text-sm text-muted-foreground">Plan, execute and review compliance audits.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchAudits()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            {can("audit:create") && (
              <Button
                size="sm"
                className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
                onClick={() => setDrawerOpen(true)}
              >
                <Plus className="h-4 w-4" /> New Audit
              </Button>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
              <p.icon className={cn("h-3.5 w-3.5", p.color)} />
              <span className="text-xs text-muted-foreground">{p.label}</span>
              <span className="text-sm font-semibold">{p.value}</span>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search audits..."
          filters={FILTER_CONFIGS}
          values={filterVals}
          onFilterChange={(key, val) => setFilterVals((prev) => ({ ...prev, [key]: val }))}
          onClear={() => { setSearch(""); setFilterVals({}); }}
        />

        {/* Table */}
        {loading && !initialized ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 py-16">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium">No audits found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || Object.values(filterVals).some((v) => v && v !== "ALL")
                ? "Try adjusting filters"
                : "Create your first audit to get started"}
            </p>
            {!search && !Object.values(filterVals).some((v) => v && v !== "ALL") && can("audit:create") && (
              <Button size="sm" className="mt-4 gap-2 [background:var(--gradient-primary)] text-primary-foreground" onClick={() => setDrawerOpen(true)}>
                <Plus className="h-4 w-4" /> New Audit
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-[110px] text-xs">Ref #</TableHead>
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="hidden md:table-cell text-xs">Type</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs">Site</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs">Assignee</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs">Scheduled</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs w-[80px]">Score</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((audit) => (
                  <TableRow
                    key={audit.id}
                    className="border-border/60 cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate({ to: "/app/audits/$id", params: { id: audit.id } })}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{audit.refNumber}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{audit.title}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[audit.status] ?? "bg-gray-500/10 text-gray-600")}>
                        {audit.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {audit.type.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{audit.site?.name ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {audit.assignedTo ? `${audit.assignedTo.firstName} ${audit.assignedTo.lastName}` : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {audit.scheduledAt ? new Date(audit.scheduledAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm font-semibold">
                      {audit.percentage != null ? (
                        <span className={audit.passed ? "text-green-500" : "text-red-500"}>
                          {audit.percentage.toFixed(0)}%
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right pr-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create drawer */}
      <ModuleDrawer
        open={drawerOpen && can("audit:create")}
        onOpenChange={setDrawerOpen}
        title="New Audit"
        description="Create a new compliance audit"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              form="create-audit-form"
              type="submit"
              disabled={submitting || !form.title}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
            >
              {submitting ? "Creating..." : "Create Audit"}
            </Button>
          </div>
        }
      >
        <form id="create-audit-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="audit-title">Title <span className="text-red-500">*</span></Label>
            <Input
              id="audit-title"
              placeholder="e.g. Q2 Safety Compliance Audit"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-type">Audit Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger id="audit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audit-scheduled">Scheduled Date</Label>
              <Input
                id="audit-scheduled"
                type="date"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-due">Due Date</Label>
              <Input
                id="audit-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audit-desc">Description</Label>
            <Textarea
              id="audit-desc"
              placeholder="Describe the scope and objectives..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {customFields.length > 0 && (
            <div className="space-y-4 border-t border-border/40 pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Additional Fields</p>
              {customFields.map((f) => {
                const opts = (f.options ?? []) as { label: string; value: string }[];
                const value = metadata[f.name];
                const strVal = String(value ?? "");
                const labelEl = (
                  <Label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    {f.label}{f.isRequired && <span className="ml-1 text-red-500">*</span>}
                  </Label>
                );

                let content: React.ReactNode;
                if (f.type === "TEXTAREA") {
                  content = (<>{labelEl}<Textarea value={strVal} onChange={(e) => handleMeta(f.name, e.target.value)} placeholder={f.placeholder ?? ""} rows={3} required={f.isRequired} />{f.helpText && <p className="mt-1 text-[11px] text-muted-foreground">{f.helpText}</p>}</>);
                } else if (f.type === "SELECT") {
                  content = (<>{labelEl}<Select value={strVal} onValueChange={(v) => handleMeta(f.name, v)}><SelectTrigger className="h-9"><SelectValue placeholder={f.placeholder ?? "Select…"} /></SelectTrigger><SelectContent>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>{f.helpText && <p className="mt-1 text-[11px] text-muted-foreground">{f.helpText}</p>}</>);
                } else if (f.type === "MULTISELECT") {
                  const sel: string[] = Array.isArray(value) ? (value as string[]) : [];
                  content = (<>{labelEl}<div className="space-y-1.5 rounded-lg border border-border/50 p-3">{opts.map((o) => (<label key={o.value} className="flex cursor-pointer items-center gap-2.5"><input type="checkbox" checked={sel.includes(o.value)} onChange={(e) => handleMeta(f.name, e.target.checked ? [...sel, o.value] : sel.filter((v) => v !== o.value))} className="h-4 w-4 rounded border-border accent-primary" /><span className="text-sm">{o.label}</span></label>))}</div>{f.helpText && <p className="mt-1 text-[11px] text-muted-foreground">{f.helpText}</p>}</>);
                } else if (f.type === "CHECKBOX") {
                  content = (<div className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3"><Switch id={f.name} checked={Boolean(value)} onCheckedChange={(v) => handleMeta(f.name, v)} /><Label htmlFor={f.name} className="cursor-pointer text-sm">{f.label}</Label></div>);
                } else {
                  const typeMap: Record<string, string> = { DATE: "date", EMAIL: "email", PHONE: "tel", URL: "url", NUMBER: "number", TEXT: "text" };
                  content = (<>{labelEl}<Input type={typeMap[f.type] ?? "text"} value={strVal} onChange={(e) => handleMeta(f.name, e.target.value)} placeholder={f.placeholder ?? ""} required={f.isRequired} className="h-9" />{f.helpText && <p className="mt-1 text-[11px] text-muted-foreground">{f.helpText}</p>}</>);
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
        </form>
      </ModuleDrawer>
    </AppShell>
  );
}
