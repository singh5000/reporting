import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, BookOpen, Users, Clock, Award, Pencil, Trash2, RefreshCw,
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
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { usePermissions } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/training/$id")({
  head: () => ({ meta: [{ title: "Training Detail · 360CRD" }] }),
  component: TrainingDetailPage,
});

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     "bg-gray-500/10 text-gray-600 border-gray-500/20",
  PUBLISHED: "bg-green-500/10 text-green-600 border-green-500/20",
  ARCHIVED:  "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

const CATEGORIES = ["SAFETY", "COMPLIANCE", "OPERATIONS", "LEADERSHIP", "TECHNICAL", "OTHER"];

function TrainingDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const can = usePermissions();
  const [training, setTraining] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", category: "SAFETY", durationMinutes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(ENDPOINTS.training.detail(id));
      const data = res?.data ?? res;
      setTraining(data);
      setEditForm({
        title: data.title ?? "",
        description: data.description ?? "",
        category: data.category ?? "SAFETY",
        durationMinutes: data.durationMinutes ? String(data.durationMinutes) : "",
      });
    } catch {
      toast.error("Failed to load training program");
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
      const res = await apiClient.patch<any>(ENDPOINTS.training.update(id), {
        title: editForm.title,
        description: editForm.description || undefined,
        category: editForm.category,
        durationMinutes: editForm.durationMinutes ? Number(editForm.durationMinutes) : undefined,
      });
      setTraining(res?.data ?? res);
      toast.success("Training updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update training");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this training program? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiClient.delete(ENDPOINTS.training.remove(id));
      toast.success("Training deleted");
      navigate({ to: "/admin/training" });
    } catch {
      toast.error("Failed to delete training");
      setDeleting(false);
    }
  }

  async function handlePublish() {
    setStatusBusy(true);
    try {
      const res = await apiClient.put<any>(ENDPOINTS.training.publish(id), {});
      setTraining(res?.data ?? res);
      toast.success("Training published");
    } catch {
      toast.error("Failed to publish training");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleArchive() {
    setStatusBusy(true);
    try {
      const res = await apiClient.put<any>(ENDPOINTS.training.archive(id), {});
      setTraining(res?.data ?? res);
      toast.success("Training archived");
    } catch {
      toast.error("Failed to archive training");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <Link
          to="/admin/training"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to training
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Skeleton className="h-40 rounded-xl lg:col-span-2" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </div>
        ) : notFound || !training ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-base font-semibold">Training not found</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed or the link is invalid.</p>
          </SurfaceCard>
        ) : (
          <div className="space-y-6">
            <SurfaceCard className="p-6 md:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{training.title}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_COLOR[training.status] ?? "bg-gray-500/10 text-gray-600")}>
                      {training.status}
                    </span>
                    {training.category && (
                      <span className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {training.category}
                      </span>
                    )}
                    {training.durationMinutes && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {training.durationMinutes} min
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {can("training:update") && (
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                  )}
                  {can("training:update") && training.status === "DRAFT" && (
                    <Button size="sm" disabled={statusBusy} onClick={handlePublish}
                      className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
                      {statusBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4 mr-1.5" />}
                      Publish
                    </Button>
                  )}
                  {can("training:update") && training.status === "PUBLISHED" && (
                    <Button variant="outline" size="sm" disabled={statusBusy} onClick={handleArchive}>
                      {statusBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                      Archive
                    </Button>
                  )}
                  {can("training:delete") && (
                    <Button variant="outline" size="sm" disabled={deleting} onClick={handleDelete}
                      className="border-red-500/30 text-red-600 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4 mr-1.5" /> {deleting ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </div>
            </SurfaceCard>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {training.description && (
                  <SurfaceCard className="p-6">
                    <h2 className="text-sm font-semibold text-foreground">Description</h2>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                      {training.description}
                    </p>
                  </SurfaceCard>
                )}
              </div>

              <div className="space-y-4">
                <SurfaceCard className="p-6">
                  <h2 className="text-sm font-semibold text-foreground">Details</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[training.status])}>
                        {training.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{training.category ?? "—"}</span>
                    </div>
                    {training.durationMinutes != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">{training.durationMinutes} min</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Enrollments
                      </span>
                      <span className="font-medium">{training._count?.enrollments ?? 0}</span>
                    </div>
                    <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      Created {new Date(training.createdAt).toLocaleDateString()}
                    </div>
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
        title="Edit Training Program"
        description="Update training details"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button form="edit-training-form" type="submit" disabled={submitting || !editForm.title}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form id="edit-training-form" onSubmit={handleEdit} className="space-y-5">
          <div className="space-y-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input type="number" min={1} value={editForm.durationMinutes}
                onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea rows={4} value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </form>
      </ModuleDrawer>
    </AppShell>
  );
}
