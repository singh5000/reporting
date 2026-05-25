import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Users, Award, Pencil, Trash2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { usePermissions } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/inductions/$id")({
  head: () => ({ meta: [{ title: "Induction Detail · 360CRD" }] }),
  component: InductionDetailPage,
});

const STATUS_COLOR: Record<string, string> = {
  DRAFT:     "bg-gray-500/10 text-gray-600 border-gray-500/20",
  PUBLISHED: "bg-green-500/10 text-green-600 border-green-500/20",
  ARCHIVED:  "bg-orange-500/10 text-orange-600 border-orange-500/20",
};

function InductionDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const can = usePermissions();
  const [induction, setInduction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", passingScore: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(ENDPOINTS.inductions.detail(id));
      const data = res?.data ?? res;
      setInduction(data);
      setEditForm({
        title: data.title ?? "",
        description: data.description ?? "",
        passingScore: data.passingScore != null ? String(data.passingScore) : "",
      });
    } catch {
      toast.error("Failed to load induction");
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
      const res = await apiClient.patch<any>(ENDPOINTS.inductions.update(id), {
        title: editForm.title,
        description: editForm.description || undefined,
        passingScore: editForm.passingScore ? Number(editForm.passingScore) : undefined,
      });
      setInduction(res?.data ?? res);
      toast.success("Induction updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update induction");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this induction program? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiClient.delete(ENDPOINTS.inductions.remove(id));
      toast.success("Induction deleted");
      navigate({ to: "/admin/inductions" });
    } catch {
      toast.error("Failed to delete induction");
      setDeleting(false);
    }
  }

  async function handlePublish() {
    setStatusBusy(true);
    try {
      const res = await apiClient.put<any>(ENDPOINTS.inductions.publish(id), {});
      setInduction(res?.data ?? res);
      toast.success("Induction published");
    } catch {
      toast.error("Failed to publish induction");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <Link to="/admin/inductions"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to inductions
        </Link>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Skeleton className="h-40 rounded-xl lg:col-span-2" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          </div>
        ) : notFound || !induction ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-base font-semibold">Induction not found</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed or the link is invalid.</p>
          </SurfaceCard>
        ) : (
          <div className="space-y-6">
            <SurfaceCard className="p-6 md:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{induction.title}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_COLOR[induction.status] ?? "bg-gray-500/10 text-gray-600")}>
                      {induction.status}
                    </span>
                    {induction.site?.name && (
                      <span className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {induction.site.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {can("induction:update") && (
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil className="h-4 w-4 mr-1.5" /> Edit
                    </Button>
                  )}
                  {can("induction:update") && induction.status === "DRAFT" && (
                    <Button size="sm" disabled={statusBusy} onClick={handlePublish}
                      className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
                      {statusBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4 mr-1.5" />}
                      Publish
                    </Button>
                  )}
                  {can("induction:delete") && (
                    <Button variant="outline" size="sm" disabled={deleting} onClick={handleDelete}
                      className="border-red-500/30 text-red-600 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4 mr-1.5" /> {deleting ? "Deleting..." : "Delete"}
                    </Button>
                  )}
                </div>
              </div>
            </SurfaceCard>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {induction.description && (
                  <SurfaceCard className="p-6">
                    <h2 className="text-sm font-semibold text-foreground">Description</h2>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                      {induction.description}
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
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[induction.status])}>
                        {induction.status}
                      </span>
                    </div>
                    {induction.passingScore != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Passing Score</span>
                        <span className="font-medium">{induction.passingScore}%</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Enrollments
                      </span>
                      <span className="font-medium">{induction._count?.enrollments ?? 0}</span>
                    </div>
                    {induction.site?.name && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Site</span>
                        <span className="font-medium">{induction.site.name}</span>
                      </div>
                    )}
                    <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      Created {new Date(induction.createdAt).toLocaleDateString()}
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
        title="Edit Induction Program"
        description="Update induction details"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button form="edit-induction-form" type="submit" disabled={submitting || !editForm.title}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form id="edit-induction-form" onSubmit={handleEdit} className="space-y-5">
          <div className="space-y-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Passing Score (%)</Label>
            <Input type="number" min={0} max={100} value={editForm.passingScore}
              onChange={(e) => setEditForm((f) => ({ ...f, passingScore: e.target.value }))} />
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
