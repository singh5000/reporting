import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2, ClipboardCheck, CornerDownLeft, FileText,
  Plus, Search, ShieldAlert, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { http } from "@/lib/api/axios";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { type SearchCategory, type SearchItem } from "@/lib/search-store";

type Action = { id: string; label: string; hint: string; icon: typeof Plus; to: string };

const QUICK_ACTIONS: Action[] = [
  { id: "qa-audit",    label: "Create Audit",    hint: "Start a new audit",  icon: ClipboardCheck, to: "/app/audits/create" },
  { id: "qa-incident", label: "Report Incident", hint: "Log a new incident", icon: ShieldAlert,    to: "/app/incidents/create" },
];

const CATEGORY_ICON: Record<SearchCategory, typeof FileText> = {
  Incidents:  ShieldAlert,
  Audits:     ClipboardCheck,
  Facilities: Building2,
};

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="rounded bg-primary/20 text-primary">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

async function runSearch(q: string): Promise<SearchItem[]> {
  const [incidents, audits, sites] = await Promise.allSettled([
    http.get<any>(ENDPOINTS.incidents.list, { params: { search: q, limit: 5 } }),
    http.get<any>(ENDPOINTS.audits.list,    { params: { search: q, limit: 5 } }),
    http.get<any>(ENDPOINTS.sites.list,     { params: { search: q, limit: 5 } }),
  ]);
  const out: SearchItem[] = [];
  if (incidents.status === "fulfilled")
    for (const inc of (incidents.value.data?.data ?? []))
      out.push({ id: inc.id, category: "Incidents", title: `${inc.refNumber} · ${inc.title}`, subtitle: [inc.location ?? inc.site?.name, inc.status].filter(Boolean).join(" · "), to: "/app/incidents" });
  if (audits.status === "fulfilled")
    for (const aud of (audits.value.data?.data ?? []))
      out.push({ id: aud.id, category: "Audits", title: `${aud.refNumber} · ${aud.title}`, subtitle: [aud.site?.name, aud.status].filter(Boolean).join(" · "), to: "/app/audits" });
  if (sites.status === "fulfilled")
    for (const site of (sites.value.data?.data ?? []))
      out.push({ id: site.id, category: "Facilities", title: site.name, subtitle: [site.type, site.status].filter(Boolean).join(" · "), to: "/app/sites" });
  return out;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [active, setActive]   = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) { setQuery(""); setResults([]); setActive(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      try { setResults(await runSearch(q)); } catch { setResults([]); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const q          = query.trim().toLowerCase();
  const actionRows = QUICK_ACTIONS.filter((a) => !q || a.label.toLowerCase().includes(q));
  const totalRows  = actionRows.length + results.length;

  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const execAction = (a: Action) => { onClose(); navigate({ to: a.to as any }); };
  const execResult = (item: SearchItem) => { onClose(); navigate({ to: item.to as any }); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, totalRows - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (active < actionRows.length) execAction(actionRows[active]);
      else execResult(results[active - actionRows.length]);
    }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  const grouped: Partial<Record<SearchCategory, SearchItem[]>> = {};
  for (const item of results) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category]!.push(item);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-background/60 px-4 pt-[10vh] backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or run a command…"
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden h-5 items-center rounded border border-border/60 bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:flex">ESC</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {actionRows.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
              {actionRows.map((a, idx) => {
                const Icon = a.icon;
                const isActive = idx === active;
                return (
                  <button key={a.id} type="button" onMouseEnter={() => setActive(idx)} onClick={() => execAction(a)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors", isActive ? "bg-accent text-foreground" : "text-foreground/90 hover:bg-accent/60")}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{highlight(a.label, query)}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.hint}</p>
                    </div>
                    {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          )}

          {(Object.keys(grouped) as SearchCategory[]).map((cat) => {
            const items = grouped[cat]!;
            const Icon  = CATEGORY_ICON[cat];
            return (
              <div key={cat} className="mb-2">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                {items.map((item) => {
                  const idx = actionRows.length + results.indexOf(item);
                  const isActive = idx === active;
                  return (
                    <button key={item.id} type="button" onMouseEnter={() => setActive(idx)} onClick={() => execResult(item)}
                      className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors", isActive ? "bg-accent text-foreground" : "text-foreground/90 hover:bg-accent/60")}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-inset ring-border"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{highlight(item.title, query)}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                      {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {totalRows === 0 && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">No results</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different keyword or action.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="rounded border border-border/60 bg-muted px-1">↑</kbd><kbd className="rounded border border-border/60 bg-muted px-1">↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-border/60 bg-muted px-1">↵</kbd> open</span>
          </div>
          <span>360CRD · Command Palette</span>
        </div>
      </div>
    </div>
  );
}
