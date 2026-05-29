import { useEffect, useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Plus, RefreshCw, ShieldAlert, Send, AlertTriangle,
  TrendingUp, Clock, CheckCircle2, ChevronRight, Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { FilterBar, type FilterConfig } from "@/components/shared/FilterBar";
import { useIncidentStore } from "@/lib/stores/incident.store";
import { usePermissions, useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/_authenticated/app/incidents/")({
  head: () => ({
    meta: [
      { title: "Incidents · 360CRD" },
      { name: "description", content: "Track, triage and resolve incidents." },
    ],
  }),
  component: IncidentsPage,
});

// ── Colour maps ───────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  OPEN:          "bg-red-500/10 text-red-600 border-red-500/20",
  REPORTED:      "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  INVESTIGATING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  IN_REVIEW:     "bg-purple-500/10 text-purple-600 border-purple-500/20",
  RESOLVED:      "bg-green-500/10 text-green-600 border-green-500/20",
  CLOSED:        "bg-gray-500/10 text-gray-600 border-gray-500/20",
  CANCELLED:     "bg-gray-500/10 text-gray-400 border-gray-400/20",
};

const SEVERITY_COLOR: Record<string, string> = {
  LOW:      "bg-gray-500/10 text-gray-600",
  MEDIUM:   "bg-yellow-500/10 text-yellow-600",
  HIGH:     "bg-orange-500/10 text-orange-600",
  CRITICAL: "bg-red-500/10 text-red-600",
};

// ── Filter config ─────────────────────────────────────────────────────────────
const FILTER_CONFIGS: FilterConfig[] = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "OPEN", label: "Open" },
      { value: "REPORTED", label: "Reported" },
      { value: "INVESTIGATING", label: "Investigating" },
      { value: "IN_REVIEW", label: "In Review" },
      { value: "RESOLVED", label: "Resolved" },
      { value: "CLOSED", label: "Closed" },
      { value: "CANCELLED", label: "Cancelled" },
    ],
  },
  {
    key: "severity",
    label: "Severity",
    options: [
      { value: "LOW", label: "Low" },
      { value: "MEDIUM", label: "Medium" },
      { value: "HIGH", label: "High" },
      { value: "CRITICAL", label: "Critical" },
    ],
  },
  {
    key: "type",
    label: "Type",
    options: [
      { value: "SAFETY", label: "Safety" },
      { value: "ENVIRONMENTAL", label: "Environmental" },
      { value: "QUALITY", label: "Quality" },
      { value: "SECURITY", label: "Security" },
      { value: "NEAR_MISS", label: "Near Miss" },
      { value: "PROPERTY_DAMAGE", label: "Property Damage" },
      { value: "OTHER", label: "Other" },
    ],
  },
];

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
const PRIORITY_MAP: Record<string, number> = { LOW: 1, MEDIUM: 3, HIGH: 4, CRITICAL: 5 };

// ── Create Drawer Form ────────────────────────────────────────────────────────
function CreateIncidentForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { createIncident } = useIncidentStore();
  const { user } = useAuth();
  const canManage = user?.role === "manager" || user?.role === "tenant_admin";
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
    if (description.trim().length < 3) {
      setDescError("Description must be at least 3 characters.");
      return;
    }
    setDescError("");
    setSubmitting(true);
    try {
      await createIncident({
        title: title.trim() || description.trim().slice(0, 120),
        description: description.trim(),
        type,
        category,
        severity,
        priority: PRIORITY_MAP[priority],
        occurredAt: new Date(occurredAt).toISOString(),
        location: location.trim() || undefined,
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      });
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id="create-incident-form" onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief description of the incident"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Description <span className="text-red-500">*</span>
        </Label>
        <Textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDescError(""); }}
          placeholder="What happened, where and when. Include immediate actions taken. (min. 10 characters)"
          rows={3}
          required
        />
        {descError && <p className="text-xs text-red-500 mt-1">{descError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Incident Type <span className="text-red-500">*</span>
          </Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INCIDENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Category <span className="text-red-500">*</span>
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {INCIDENT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Date &amp; Time <span className="text-red-500">*</span>
          </Label>
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="h-9"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Location
          </Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Building, area, or GPS"
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Severity
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className={cn(
                "h-9 rounded-lg border text-xs font-semibold transition-all",
                severity === s
                  ? s === "LOW" ? "border-gray-400 bg-gray-500/10 text-gray-700"
                    : s === "MEDIUM" ? "border-yellow-400 bg-yellow-500/10 text-yellow-700"
                    : s === "HIGH" ? "border-orange-400 bg-orange-500/10 text-orange-700"
                    : "border-red-400 bg-red-500/10 text-red-700"
                  : "border-border/60 text-muted-foreground hover:border-border",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Priority
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "h-9 rounded-lg border text-xs font-semibold transition-all",
                priority === p
                  ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_12%,transparent)]"
                  : "border-border/60 text-muted-foreground hover:border-border",
              )}
            >
              {p}
            </button>
          ))}
        </div>
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
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatPill({
  label, value, icon: Icon, color,
}: {
  label: string; value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/60 px-4 py-2.5">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold leading-none text-foreground">{value}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function IncidentsPage() {
  const { incidents, loading, initialized, fetchIncidents } = useIncidentStore();
  const can = usePermissions();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filtered = useMemo(() => {
    return incidents.filter((inc) => {
      if (filterValues.status && filterValues.status !== "ALL" && inc.status !== filterValues.status) return false;
      if (filterValues.severity && filterValues.severity !== "ALL" && inc.severity !== filterValues.severity) return false;
      if (filterValues.type && filterValues.type !== "ALL" && inc.type !== filterValues.type) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${inc.title} ${inc.refNumber} ${inc.site?.name ?? ""} ${inc.reportedBy?.firstName ?? ""} ${inc.reportedBy?.lastName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [incidents, search, filterValues]);

  const stats = useMemo(() => ({
    total: incidents.length,
    open: incidents.filter((i) => ["OPEN", "REPORTED", "INVESTIGATING", "IN_REVIEW"].includes(i.status)).length,
    critical: incidents.filter((i) => i.severity === "CRITICAL").length,
    resolved: incidents.filter((i) => i.status === "RESOLVED").length,
  }), [incidents]);

  const handleFilterChange = (key: string, val: string) =>
    setFilterValues((prev) => ({ ...prev, [key]: val }));

  const handleClear = () => { setSearch(""); setFilterValues({}); };

  const handleCreateSuccess = () => { setDrawerOpen(false); };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5 animate-in fade-in duration-300">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Incidents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track, triage and resolve operational incidents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchIncidents()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            {can("incident:create") && (
              <Button
                size="sm"
                onClick={() => setDrawerOpen(true)}
                className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> Report Incident
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {!loading && incidents.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Total" value={stats.total} icon={ShieldAlert} color="bg-primary/10 text-primary" />
            <StatPill label="Open" value={stats.open} icon={Clock} color="bg-orange-500/10 text-orange-500" />
            <StatPill label="Critical" value={stats.critical} icon={AlertTriangle} color="bg-red-500/10 text-red-500" />
            <StatPill label="Resolved" value={stats.resolved} icon={CheckCircle2} color="bg-green-500/10 text-green-500" />
          </div>
        )}

        {/* Filter bar */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search incidents..."
          filters={FILTER_CONFIGS}
          values={filterValues}
          onFilterChange={handleFilterChange}
          onClear={handleClear}
        />

        {/* Content */}
        {loading && !initialized ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-sm font-medium text-foreground">
              {incidents.length === 0 ? "No incidents yet" : "No incidents match filters"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {incidents.length === 0
                ? "Report the first incident to get started."
                : "Try adjusting your search or filter criteria."}
            </p>
            {incidents.length === 0 && can("incident:create") && (
              <Button
                size="sm"
                className="mt-4 gap-2 [background:var(--gradient-primary)] text-primary-foreground"
                onClick={() => setDrawerOpen(true)}
              >
                <Plus className="h-4 w-4" /> Report Incident
              </Button>
            )}
          </SurfaceCard>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
                <span className="font-semibold text-foreground">{incidents.length}</span> incidents
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider">Ref #</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Title</TableHead>
                  <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="w-[90px] text-xs font-semibold uppercase tracking-wider">Severity</TableHead>
                  <TableHead className="w-[90px] text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Type</TableHead>
                  <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Site</TableHead>
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">Reporter</TableHead>
                  <TableHead className="w-[100px] text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Date</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inc) => (
                  <TableRow
                    key={inc.id}
                    className="group cursor-pointer border-border/40 hover:bg-accent/40"
                    onClick={() => navigate({ to: "/app/incidents/$id", params: { id: inc.id } })}
                  >
                    <TableCell>
                      <Link
                        to="/app/incidents/$id"
                        params={{ id: inc.id }}
                        className="block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
                          {inc.refNumber}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to="/app/incidents/$id" params={{ id: inc.id }} className="block">
                        <p className="font-medium text-foreground text-sm leading-snug line-clamp-1">
                          {inc.title}
                        </p>
                        {inc.location && (
                          <p className="text-xs text-muted-foreground mt-0.5">{inc.location}</p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                          STATUS_COLOR[inc.status] ?? "bg-gray-500/10 text-gray-600 border-gray-500/20",
                        )}
                      >
                        {inc.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                          SEVERITY_COLOR[inc.severity] ?? "bg-gray-500/10 text-gray-600",
                        )}
                      >
                        {inc.severity}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {inc.type?.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs text-foreground/80">
                        {inc.site?.name ?? <span className="text-muted-foreground/50">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs text-foreground/80">
                        {inc.reportedBy
                          ? `${inc.reportedBy.firstName} ${inc.reportedBy.lastName}`
                          : <span className="text-muted-foreground/50">—</span>}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {new Date(inc.occurredAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/app/incidents/$id"
                        params={{ id: inc.id }}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
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
        open={drawerOpen && can("incident:create")}
        onOpenChange={setDrawerOpen}
        title="Report Incident"
        description="Document what happened, classify severity, and notify the team."
        size="md"
        footer={
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-incident-form"
              size="sm"
              className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
            >
              <Send className="h-3.5 w-3.5" />
              Submit Report
            </Button>
          </div>
        }
      >
        <CreateIncidentForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setDrawerOpen(false)}
        />
      </ModuleDrawer>
    </AppShell>
  );
}
