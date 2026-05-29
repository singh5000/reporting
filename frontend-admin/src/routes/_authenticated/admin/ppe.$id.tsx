import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, HardHat, Tag, User, Calendar, AlertTriangle, CheckCircle2, Package,
  Pencil, Trash2, Loader2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SurfaceCard } from "@/components/shared/Card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { usePermissions } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/ppe/$id")({
  head: () => ({ meta: [{ title: "PPE Detail · 360CRD" }] }),
  component: PPEDetailPage,
});

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE:   "bg-green-500/10 text-green-600 border-green-500/20",
  ASSIGNED:    "bg-blue-500/10 text-blue-600 border-blue-500/20",
  MAINTENANCE: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  DISPOSED:    "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const CONDITION_COLOR: Record<string, string> = {
  EXCELLENT: "bg-green-500/10 text-green-600 border-green-500/20",
  GOOD:      "bg-blue-500/10 text-blue-600 border-blue-500/20",
  FAIR:      "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  POOR:      "bg-orange-500/10 text-orange-600 border-orange-500/20",
  DAMAGED:   "bg-red-500/10 text-red-600 border-red-500/20",
};

const PPE_CATEGORIES = ["HEAD","EYE","EAR","RESPIRATORY","HAND","FOOT","BODY","HIGH_VIS","FALL_PROTECTION","OTHER"];
const PPE_STATUSES   = ["AVAILABLE","ASSIGNED","MAINTENANCE","DISPOSED"];

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

function PPEDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const can = usePermissions();

  const [item, setItem]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editForm, setEditForm] = useState({ name: "", category: "", manufacturer: "", model: "", serialNumber: "", status: "" });

  function load() {
    setLoading(true);
    apiClient
      .get<any>(ENDPOINTS.ppe.detail(id))
      .then((res) => {
        const d = res.data;
        setItem(d);
        setEditForm({
          name:         d.name ?? "",
          category:     d.category ?? "HEAD",
          manufacturer: d.manufacturer ?? "",
          model:        d.model ?? "",
          serialNumber: d.serialNumber ?? "",
          status:       d.status ?? "AVAILABLE",
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch(ENDPOINTS.ppe.update(id), {
        name:         editForm.name || undefined,
        category:     editForm.category || undefined,
        manufacturer: editForm.manufacturer || undefined,
        model:        editForm.model || undefined,
        serialNumber: editForm.serialNumber || undefined,
        status:       editForm.status || undefined,
      });
      toast.success("PPE item updated");
      setEditOpen(false);
      load();
    } catch {
      toast.error("Failed to update PPE item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this PPE item? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await apiClient.delete(ENDPOINTS.ppe.remove(id));
      toast.success("PPE item deleted");
      navigate({ to: "/admin/ppe" });
    } catch {
      toast.error("Failed to delete PPE item");
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <Link
            to="/admin/ppe"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to PPE inventory
          </Link>
          {!loading && item && (
            <div className="flex items-center gap-2">
              {can("ppe:update") && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {can("ppe:delete") && (
                <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Skeleton className="h-48 rounded-xl lg:col-span-2" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </div>
        ) : notFound || !item ? (
          <SurfaceCard className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border">
              <HardHat className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">PPE item not found</p>
            <p className="mt-1 text-sm text-muted-foreground">It may have been removed or the link is invalid.</p>
          </SurfaceCard>
        ) : (
          <div className="space-y-6">
            <SurfaceCard className="p-6 md:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {item.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{item.name}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_COLOR[item.status] ?? "bg-gray-500/10 text-gray-600")}>
                      {item.status}
                    </span>
                    {item.condition && (
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", CONDITION_COLOR[item.condition] ?? "bg-gray-500/10 text-gray-600")}>
                        {item.condition}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/60 pt-6 sm:grid-cols-3 lg:grid-cols-4">
                <MetaItem icon={Package} label="Manufacturer" value={item.manufacturer} />
                <MetaItem icon={Tag} label="Model" value={item.model} />
                <MetaItem icon={Tag} label="Serial Number" value={item.serialNumber} />
                <MetaItem icon={Tag} label="Storage Location" value={item.storageLocation} />
                <MetaItem icon={Calendar} label="Purchase Date" value={item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString() : null} />
                <MetaItem icon={AlertTriangle} label="Expiry Date" value={item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : null} />
              </div>
            </SurfaceCard>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {item.assignments && item.assignments.length > 0 ? (
                  <SurfaceCard className="p-6">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Assignment History ({item.assignments.length})
                    </h2>
                    <ul className="mt-4 space-y-3">
                      {item.assignments.map((a: any) => (
                        <li key={a.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {a.user ? `${a.user.firstName} ${a.user.lastName}` : "Unknown"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Assigned {new Date(a.assignedAt).toLocaleDateString()}
                              {a.returnedAt && ` → Returned ${new Date(a.returnedAt).toLocaleDateString()}`}
                            </p>
                            {a.notes && <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>}
                          </div>
                          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            a.returnedAt
                              ? "bg-gray-500/10 text-gray-600 border-gray-500/20"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          )}>
                            {a.returnedAt ? "Returned" : "Active"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SurfaceCard>
                ) : (
                  <SurfaceCard className="p-6 flex flex-col items-center justify-center py-10 text-center">
                    <User className="h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">No assignment history</p>
                  </SurfaceCard>
                )}
              </div>

              <div>
                <SurfaceCard className="p-6">
                  <h2 className="text-sm font-semibold text-foreground">Details</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[item.status] ?? "bg-gray-500/10 text-gray-600")}>
                        {item.status}
                      </span>
                    </div>
                    {item.condition && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Condition</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", CONDITION_COLOR[item.condition] ?? "bg-gray-500/10 text-gray-600")}>
                          {item.condition}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Category</span>
                      <span className="font-medium">{item.category.replace(/_/g, " ")}</span>
                    </div>
                    {item.assignments && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Assignments</span>
                        <span className="font-medium">{item.assignments.length}</span>
                      </div>
                    )}
                    <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      Added {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </SurfaceCard>

                {item.assignments?.some((a: any) => !a.returnedAt) && (
                  <SurfaceCard className="mt-4 p-6">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-blue-500" /> Currently Assigned
                    </h2>
                    {item.assignments.filter((a: any) => !a.returnedAt).map((a: any) => (
                      <div key={a.id} className="mt-3">
                        <p className="text-sm font-medium text-foreground">
                          {a.user ? `${a.user.firstName} ${a.user.lastName}` : "Unknown"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Since {new Date(a.assignedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </SurfaceCard>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Drawer */}
      <ModuleDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit PPE Item"
        description="Update PPE item details"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button form="edit-ppe-form" type="submit" disabled={saving}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form id="edit-ppe-form" onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PPE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PPE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Manufacturer</Label>
            <Input value={editForm.manufacturer} onChange={(e) => setEditForm((f) => ({ ...f, manufacturer: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Input value={editForm.model} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input value={editForm.serialNumber} onChange={(e) => setEditForm((f) => ({ ...f, serialNumber: e.target.value }))} />
            </div>
          </div>
        </form>
      </ModuleDrawer>
    </AppShell>
  );
}
