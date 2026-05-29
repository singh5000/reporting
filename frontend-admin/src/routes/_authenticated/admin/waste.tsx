import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw, Recycle, Scale, DollarSign, Pencil, Trash2, Loader2, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FilterBar } from "@/components/shared/FilterBar";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePermissions } from "@/lib/auth-store";
import { useTenantGuard } from "@/lib/hooks/useTenantGuard";

export const Route = createFileRoute("/_authenticated/admin/waste")({
  head: () => ({ meta: [{ title: "Waste · 360CRD" }] }),
  component: WastePage,
});

const STATUS_COLOR: Record<string, string> = {
  PENDING:    "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  COLLECTED:  "bg-blue-500/10  text-blue-600  border-blue-500/20",
  DISPOSED:   "bg-green-500/10 text-green-600 border-green-500/20",
  DOCUMENTED: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

const WASTE_CATEGORIES = ["HAZARDOUS", "NON_HAZARDOUS", "RECYCLABLE", "ELECTRONIC", "ORGANIC", "LIQUID", "OTHER"];
const WASTE_UNITS = ["KG", "LITRES", "UNITS", "TONNES", "M3"];

const FILTER_CONFIGS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "PENDING",    label: "Pending" },
      { value: "COLLECTED",  label: "Collected" },
      { value: "DISPOSED",   label: "Disposed" },
      { value: "DOCUMENTED", label: "Documented" },
    ],
  },
  {
    key: "category",
    label: "Category",
    options: WASTE_CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") })),
  },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = { type: "", category: "NON_HAZARDOUS", quantity: "", unit: "KG", disposedAt: todayStr() };

function WastePage() {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const can = usePermissions();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { requireTenant } = useTenantGuard();
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const listRes = await apiClient.get<any>(ENDPOINTS.waste.list, { limit: 100 });
      setItems(listRes.data ?? []);
    } catch {
      toast.error("Failed to load waste records");
    } finally {
      setLoading(false);
    }
    apiClient.get<any>(ENDPOINTS.waste.stats).then((r) => setStats(r.data ?? null)).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      if (q && !(item.type ?? "").toLowerCase().includes(q) && !(item.description ?? "").toLowerCase().includes(q)) return false;
      if (filterVals.status && filterVals.status !== "ALL" && item.status !== filterVals.status) return false;
      if (filterVals.category && filterVals.category !== "ALL" && item.category !== filterVals.category) return false;
      return true;
    });
  }, [items, search, filterVals]);

  const pills = [
    { label: "Total Records", value: stats?.total ?? items.length,                                    icon: Recycle,     color: "text-foreground" },
    { label: "Total Qty",     value: stats?.totalQuantity ? `${Number(stats.totalQuantity).toFixed(1)}` : "—", icon: Scale, color: "text-blue-500" },
    { label: "Est. Cost",     value: stats?.totalCost ? `$${Number(stats.totalCost).toFixed(0)}` : "—",        icon: DollarSign, color: "text-green-500" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!requireTenant()) return;
    if (!form.type.trim()) { toast.error("Waste type is required"); return; }
    if (!form.quantity || Number(form.quantity) <= 0) { toast.error("Valid quantity is required"); return; }
    setSubmitting(true);
    try {
      const disposedAtIso = form.disposedAt
        ? new Date(form.disposedAt + "T00:00:00.000Z").toISOString()
        : new Date().toISOString();

      await apiClient.post(ENDPOINTS.waste.create, {
        type:       form.type,
        category:   form.category,
        quantity:   Number(form.quantity),
        unit:       form.unit,
        disposedAt: disposedAtIso,
      });
      toast.success("Waste record logged");
      setDrawerOpen(false);
      setForm({ ...EMPTY_FORM, disposedAt: todayStr() });
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to log waste record");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(item: any) {
    setEditItem(item);
    setEditForm({
      type:       item.type ?? "",
      category:   item.category ?? "NON_HAZARDOUS",
      quantity:   String(item.quantity ?? ""),
      unit:       item.unit ?? "KG",
      disposedAt: item.disposedAt ? item.disposedAt.slice(0, 10) : todayStr(),
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    if (!editForm.quantity || Number(editForm.quantity) <= 0) { toast.error("Valid quantity is required"); return; }
    setEditSaving(true);
    try {
      const disposedAtIso = editForm.disposedAt
        ? new Date(editForm.disposedAt + "T00:00:00.000Z").toISOString()
        : new Date().toISOString();
      await apiClient.patch(ENDPOINTS.waste.update(editItem.id), {
        type:       editForm.type || undefined,
        category:   editForm.category || undefined,
        quantity:   Number(editForm.quantity),
        unit:       editForm.unit || undefined,
        disposedAt: disposedAtIso,
      });
      toast.success("Waste record updated");
      setEditItem(null);
      load();
    } catch {
      toast.error("Failed to update waste record");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this waste record? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await apiClient.delete(ENDPOINTS.waste.remove(id));
      toast.success("Waste record deleted");
      load();
    } catch {
      toast.error("Failed to delete waste record");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Waste Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">Track and manage waste disposal records.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            {can("waste:create") && (
              <Button
                size="sm"
                className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
                onClick={() => setDrawerOpen(true)}
              >
                <Plus className="h-4 w-4" /> Log Waste
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {pills.map((p) => (
            <div key={p.label} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
              <p.icon className={cn("h-3.5 w-3.5", p.color)} />
              <span className="text-xs text-muted-foreground">{p.label}</span>
              <span className="text-sm font-semibold">{p.value}</span>
            </div>
          ))}
        </div>

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search waste records..."
          filters={FILTER_CONFIGS}
          values={filterVals}
          onFilterChange={(key, val) => setFilterVals((prev) => ({ ...prev, [key]: val }))}
          onClear={() => { setSearch(""); setFilterVals({}); }}
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 py-16">
            <Recycle className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium">No waste records found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || Object.values(filterVals).some((v) => v && v !== "ALL")
                ? "Try adjusting filters"
                : "Log your first waste disposal record"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-xs">Waste Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="hidden md:table-cell text-xs">Category</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs">Quantity</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs">Site</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs">Date</TableHead>
                  {(can("waste:update") || can("waste:delete")) && <TableHead className="w-24 text-right text-xs">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => (
                  <TableRow key={item.id} className="border-border/60 hover:bg-muted/30">
                    <TableCell className="font-medium">{item.type ?? item.description ?? "—"}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[item.status] ?? "bg-gray-500/10 text-gray-600")}>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {item.category?.replace(/_/g, " ") ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{item.site?.name ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {new Date(item.disposedAt ?? item.createdAt).toLocaleDateString()}
                    </TableCell>
                    {(can("waste:update") || can("waste:delete")) && (
                      <TableCell className="text-right pr-3">
                        <div className="flex items-center justify-end gap-1">
                          {can("waste:update") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {can("waste:delete") && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}>
                              {deletingId === item.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Trash2 className="h-3.5 w-3.5" />
                              }
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ModuleDrawer
        open={drawerOpen && can("waste:create")}
        onOpenChange={setDrawerOpen}
        title="Log Waste Record"
        description="Record a waste disposal event"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              form="create-waste-form-admin"
              type="submit"
              disabled={submitting || !form.type || !form.quantity}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
            >
              {submitting ? "Logging..." : "Log Waste"}
            </Button>
          </div>
        }
      >
        <form id="create-waste-form-admin" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="waste-type-admin">Waste Type <span className="text-red-500">*</span></Label>
            <Input
              id="waste-type-admin"
              placeholder="e.g. Chemical Solvent"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waste-category-admin">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger id="waste-category-admin"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WASTE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="waste-qty-admin">Quantity <span className="text-red-500">*</span></Label>
              <Input
                id="waste-qty-admin"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waste-unit-admin">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger id="waste-unit-admin"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WASTE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waste-date-admin">Disposal Date <span className="text-red-500">*</span></Label>
            <Input
              id="waste-date-admin"
              type="date"
              value={form.disposedAt}
              onChange={(e) => setForm((f) => ({ ...f, disposedAt: e.target.value }))}
              required
            />
          </div>
        </form>
      </ModuleDrawer>

      {/* Edit Drawer */}
      <ModuleDrawer
        open={!!editItem}
        onOpenChange={(open) => { if (!open) setEditItem(null); }}
        title="Edit Waste Record"
        description="Update waste disposal details"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button form="edit-waste-form" type="submit" disabled={editSaving}
              className="[background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form id="edit-waste-form" onSubmit={handleEditSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Waste Type <span className="text-red-500">*</span></Label>
            <Input value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WASTE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Quantity <span className="text-red-500">*</span></Label>
              <Input type="number" step="0.01" min="0.01" value={editForm.quantity}
                onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={editForm.unit} onValueChange={(v) => setEditForm((f) => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WASTE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Disposal Date</Label>
            <Input type="date" value={editForm.disposedAt}
              onChange={(e) => setEditForm((f) => ({ ...f, disposedAt: e.target.value }))} />
          </div>
        </form>
      </ModuleDrawer>
    </AppShell>
  );
}
