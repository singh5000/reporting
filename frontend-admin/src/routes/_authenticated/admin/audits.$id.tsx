import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, ClipboardCheck, Building2, User, Calendar, Tag,
  AlertTriangle, CheckCircle2, Clock, BarChart3, Pencil, Trash2,
  Play, XCircle, Plus,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { auditService, type Audit } from "@/lib/api/services/audit.service";
import { usePermissions } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/audits/$id")({
  head: () => ({
    meta: [
      { title: "Audit Detail · 360CRD" },
      { name: "description", content: "Audit details, findings and progress." },
    ],
  }),
  component: AuditDetailPage,
});

const STATUS_COLOR: Record<string, string> = {
  DRAFT:       "bg-gray-500/10 text-gray-600 border-gray-500/20",
  SCHEDULED:   "bg-blue-500/10 text-blue-600 border-blue-500/20",
  IN_PROGRESS: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  COMPLETED:   "bg-green-500/10 text-green-600 border-green-500/20",
  REVIEWED:    "bg-purple-500/10 text-purple-600 border-purple-500/20",
  CANCELLED:   "bg-red-500/10 text-red-600 border-red-500/20",
};

const FINDING_SEVERITY_COLOR: Record<string, string> = {
  LOW:      "bg-gray-500/10 text-gray-600 border-gray-500/20",
  MEDIUM:   "bg-blue-500/10 text-blue-600 border-blue-500/20",
  HIGH:     "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  CRITICAL: "bg-red-500/10 text-red-600 border-red-500/20",
};

const AUDIT_TYPES = ["SCHEDULED", "UNANNOUNCED", "FOLLOW_UP", "COMPLIANCE", "INTERNAL", "EXTERNAL"];

function MetaItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary/70">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function AuditDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const can = usePermissions();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [findingOpen, setFindingOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", type: "SCHEDULED", scheduledAt: "", dueDate: "" });
  const [findingForm, setFindingForm] = useState({ title: "", severity: "MEDIUM", type: "OBSERVATION", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await auditService.get(id);
      if (!data) { setNotFound(true); return; }
      setAudit(data);
      setEditForm({
        title: data.title ?? "",
        description: data.description ?? "",
        type: data.type ?? "SCHEDULED",
        scheduledAt: data.scheduledAt ? data.scheduledAt.split("T")[0] : "",
        dueDate: data.dueDate ? data.dueDate.split("T")[0] : "",
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load audit");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updated = await auditService.update(id, {
        title: editForm.title,
        description: editForm.description || undefined,
        type: editForm.type,
        scheduledAt: editForm.scheduledAt ? `${editForm.scheduledAt}T00:00:00.000Z` : undefined,
        dueDate: editForm.dueDate ? `${editForm.dueDate}T00:00:00.000Z` : undefined,
      });
      setAudit(updated);
      toast.success("Audit updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update audit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this audit? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await auditService.remove(id);
      toast.success("Audit deleted");
      navigate({ to: "/admin/audits" });
    } catch {
      toast.error("Failed to delete audit");
      setDeleting(false);
    }
  }

  async function handleStart() {
    setActionBusy(true);
    try {
      const updated = await auditService.start(id);
      setAudit(updated);
      toast.success("Audit started");
    } catch {
      toast.error("Failed to start audit");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this audit?")) return;
    setActionBusy(true);
    try {
      const updated = await auditService.cancel(id);
      setAudit(updated);
      toast.success("Audit cancelled");
    } catch {
      toast.error("Failed to cancel audit");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleAddFinding(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finding = await auditService.createFinding(id, {
        title: findingForm.title,
        severity: findingForm.severity,
        type: findingForm.type,
        description: findingForm.description || undefined,
      });
      setAudit((prev) => prev ? {
        ...prev,
        auditFindings: [...(prev.auditFindings ?? []), finding],
        _count: prev._count ? { ...prev._count, auditFindings: (prev._count.auditFindings ?? 0) + 1 } : prev._count,
      } : prev);
      toast.success("Finding added");
      setFindingOpen(false);
      setFindingForm({ title: "", severity: "MEDIUM", type: "OBSERVATION", description: "" });
    } catch {
      toast.error("Failed to add finding");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <Link
          to="/admin/audits"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to audits
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Skeleton className="h-48 rounded-xl lg:col-span-2" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </div>
        ) : notFound || !audit ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">Audit not found</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed or the link is invalid.</p>
          </SurfaceCard>
        ) : (
          <div className="space-y-6">
            <SurfaceCard className="p-6 md:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{audit.refNumber}</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{audit.title}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_COLOR[audit.status] ?? "bg-gray-500/10 text-gray-600")}>
                      {audit.status.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {audit.type.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {audit.percentage != null && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-card/50 px-5 py-3">
                      <span className={cn("text-2xl font-bold", audit.passed ? "text-green-500" : "text-red-500")}>
                        {audit.percentage.toFixed(0)}%
                      </span>
                      <span className="mt-0.5 text-xs text-muted-foreground">
                        {audit.grade ? `Grade ${audit.grade}` : audit.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  )}
                  {can("audit:update") && (
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                  )}
                  {can("audit:update") && audit.status === "SCHEDULED" && (
                    <Button size="sm" disabled={actionBusy} onClick={handleStart}
                      className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
                      <Play className="h-4 w-4 mr-1.5" /> Start
                    </Button>
                  )}
                  {can("audit:update") && ["SCHEDULED", "IN_PROGRESS"].includes(audit.status) && (
                    <Button variant="outline" size="sm" disabled={actionBusy} onClick={handleCancel}
                      className="border-red-500/30 text-red-600 hover:bg-red-500/10">
                      <XCircle className="h-4 w-4 mr-1.5" /> Cancel
                    </Button>
                  )}
                  {can("audit:delete") && (
                    <Button variant="outline" size="sm" disabled={deleting} onClick={handleDelete}
                      className="border-red-500/30 text-red-600 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4 mr-1.5" /> {deleting ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-6 sm:grid-cols-3 lg:grid-cols-4">
                <MetaItem icon={Building2} label="Site" value={audit.site?.name} />
                <MetaItem icon={User} label="Assigned To" value={audit.assignedTo ? `${audit.assignedTo.firstName} ${audit.assignedTo.lastName}` : null} />
                <MetaItem icon={Calendar} label="Scheduled" value={audit.scheduledAt ? new Date(audit.scheduledAt).toLocaleDateString() : null} />
                <MetaItem icon={Calendar} label="Due Date" value={audit.dueDate ? new Date(audit.dueDate).toLocaleDateString() : null} />
                <MetaItem icon={Calendar} label="Started" value={audit.startedAt ? new Date(audit.startedAt).toLocaleDateString() : null} />
                <MetaItem icon={CheckCircle2} label="Completed" value={audit.completedAt ? new Date(audit.completedAt).toLocaleDateString() : null} />
                <MetaItem icon={Tag} label="Customer" value={audit.customer?.name} />
                <MetaItem icon={User} label="Completed By" value={audit.completedBy ? `${audit.completedBy.firstName} ${audit.completedBy.lastName}` : null} />
              </div>
            </SurfaceCard>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {audit.description && (
                  <SurfaceCard className="p-6">
                    <h2 className="text-sm font-semibold text-foreground">Description</h2>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/85">{audit.description}</p>
                  </SurfaceCard>
                )}

                <SurfaceCard className="p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      Findings ({audit.auditFindings?.length ?? 0})
                    </h2>
                    {can("audit:update") && (
                      <Button variant="outline" size="sm" onClick={() => setFindingOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Finding
                      </Button>
                    )}
                  </div>
                  {audit.auditFindings && audit.auditFindings.length > 0 ? (
                    <ul className="mt-4 space-y-3">
                      {audit.auditFindings.map((finding) => (
                        <li key={finding.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{finding.title}</p>
                            {finding.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{finding.description}</p>}
                            {finding.dueDate && <p className="mt-1 text-xs text-muted-foreground">Due {new Date(finding.dueDate).toLocaleDateString()}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", FINDING_SEVERITY_COLOR[finding.severity] ?? "bg-gray-500/10 text-gray-600")}>
                              {finding.severity}
                            </span>
                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              finding.status === "CLOSED" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                            )}>
                              {finding.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No findings recorded yet.</p>
                  )}
                </SurfaceCard>
              </div>

              <div className="space-y-4">
                <SurfaceCard className="p-6">
                  <h2 className="text-sm font-semibold text-foreground">Details</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[audit.status] ?? "bg-gray-500/10 text-gray-600")}>
                        {audit.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {audit.score != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Score</span>
                        <span className="font-medium">{audit.score} / {audit.maxScore ?? "—"}</span>
                      </div>
                    )}
                    {audit._count && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Responses</span>
                          <span className="font-medium">{audit._count.responses}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Findings</span>
                          <span className="font-medium">{audit._count.auditFindings}</span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      Created {new Date(audit.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </SurfaceCard>

                <SurfaceCard className="p-6">
                  <h2 className="text-sm font-semibold text-foreground">Progress</h2>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Scheduled", icon: Clock, done: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "REVIEWED"].includes(audit.status) },
                      { label: "In Progress", icon: BarChart3, done: ["IN_PROGRESS", "COMPLETED", "REVIEWED"].includes(audit.status) },
                      { label: "Completed", icon: CheckCircle2, done: ["COMPLETED", "REVIEWED"].includes(audit.status) },
                      { label: "Reviewed", icon: CheckCircle2, done: audit.status === "REVIEWED" },
                    ].map((step) => (
                      <div key={step.label} className="flex items-center gap-3">
                        <div className={cn("flex h-7 w-7 items-center justify-center rounded-full border",
                          step.done ? "border-green-500/30 bg-green-500/10 text-green-600" : "border-border/60 bg-muted/40 text-muted-foreground/50"
                        )}>
                          <step.icon className="h-3.5 w-3.5" />
                        </div>
                        <span className={cn("text-sm", step.done ? "font-medium text-foreground" : "text-muted-foreground")}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </SurfaceCard>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModuleDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Audit"
        description="Update audit details"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button form="edit-audit-form" type="submit" disabled={submitting || !editForm.title}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form id="edit-audit-form" onSubmit={handleEdit} className="space-y-5">
          <div className="space-y-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={editForm.type} onValueChange={(v) => setEditForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input type="date" value={editForm.scheduledAt} onChange={(e) => setEditForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </form>
      </ModuleDrawer>

      <ModuleDrawer
        open={findingOpen}
        onOpenChange={setFindingOpen}
        title="Add Finding"
        description="Record an audit finding or observation"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFindingOpen(false)}>Cancel</Button>
            <Button form="add-finding-form" type="submit" disabled={submitting || !findingForm.title}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
              {submitting ? "Adding..." : "Add Finding"}
            </Button>
          </div>
        }
      >
        <form id="add-finding-form" onSubmit={handleAddFinding} className="space-y-5">
          <div className="space-y-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Missing safety signage" value={findingForm.title}
              onChange={(e) => setFindingForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={findingForm.severity} onValueChange={(v) => setFindingForm((f) => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={findingForm.type} onValueChange={(v) => setFindingForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["OBSERVATION", "NON_CONFORMANCE", "IMPROVEMENT", "POSITIVE"].map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={3} value={findingForm.description}
              onChange={(e) => setFindingForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </form>
      </ModuleDrawer>
    </AppShell>
  );
}
