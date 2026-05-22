import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw, MessageSquare, Send } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { apiClient } from "@/lib/api/api-client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleDrawer } from "@/components/shared/ModuleDrawer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal/feedback")({
  head: () => ({ meta: [{ title: "Feedback · 360CRD" }] }),
  component: PortalFeedbackPage,
});

const STATUS_COLOR: Record<string, string> = {
  OPEN:        "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  RESOLVED:    "bg-green-500/10 text-green-600 border-green-500/20",
  CLOSED:      "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const EMPTY_FORM = { subject: "", message: "", type: "GENERAL" };

function PortalFeedbackPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(ENDPOINTS.feedback.my);
      setItems(res.data ?? []);
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post(ENDPOINTS.feedback.create, {
        subject: form.subject,
        message: form.message,
        type: form.type,
      });
      toast.success("Feedback submitted successfully");
      setDrawerOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[900px] space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Feedback & Support</h1>
            <p className="mt-1 text-sm text-muted-foreground">Submit queries, complaints or feedback.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button size="sm" className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110" onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" /> New Request
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/30 py-16">
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium">No feedback submitted yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Click "New Request" to get in touch</p>
            <Button size="sm" className="mt-4 gap-2 [background:var(--gradient-primary)] text-primary-foreground" onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" /> New Request
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => (
              <div key={item.id} className="rounded-xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.subject ?? "General Feedback"}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/60">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[item.status] ?? "bg-gray-500/10 text-gray-600")}>
                    {item.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModuleDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Submit Feedback"
        description="Share your feedback, query or complaint"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button form="feedback-form" type="submit" disabled={submitting || !form.message} className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110">
              <Send className="h-4 w-4" />
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        }
      >
        <form id="feedback-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-subject">Subject</Label>
            <Input id="fb-subject" placeholder="Brief description of your query" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-message">Message <span className="text-red-500">*</span></Label>
            <Textarea id="fb-message" placeholder="Describe your feedback or issue in detail…" rows={5} required value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
          </div>
        </form>
      </ModuleDrawer>
    </AppShell>
  );
}
