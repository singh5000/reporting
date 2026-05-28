import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ClipboardCheck, Loader2, Search, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { http } from "@/lib/api/axios";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { groupByCategory, type SearchCategory, type SearchItem } from "@/lib/search-store";

const ICONS: Record<SearchCategory, typeof Search> = {
  Incidents:  ShieldAlert,
  Audits:     ClipboardCheck,
  Facilities: Building2,
  Companies:  Users,
};

async function runSearch(q: string): Promise<SearchItem[]> {
  const [incidents, audits, sites, customers] = await Promise.allSettled([
    http.get<any>(ENDPOINTS.incidents.list,  { params: { search: q, limit: 5 } }),
    http.get<any>(ENDPOINTS.audits.list,     { params: { search: q, limit: 5 } }),
    http.get<any>(ENDPOINTS.sites.list,      { params: { search: q, limit: 5 } }),
    http.get<any>(ENDPOINTS.customers.list,  { params: { search: q, limit: 5 } }),
  ]);

  const out: SearchItem[] = [];

  if (incidents.status === "fulfilled") {
    for (const inc of (incidents.value.data?.data ?? [])) {
      out.push({
        id: inc.id,
        category: "Incidents",
        title: `${inc.refNumber} · ${inc.title}`,
        subtitle: [inc.location ?? inc.site?.name, inc.status].filter(Boolean).join(" · "),
        to: "/admin/incidents",
      });
    }
  }

  if (audits.status === "fulfilled") {
    for (const aud of (audits.value.data?.data ?? [])) {
      out.push({
        id: aud.id,
        category: "Audits",
        title: `${aud.refNumber} · ${aud.title}`,
        subtitle: [aud.site?.name, aud.status].filter(Boolean).join(" · "),
        to: "/admin/audits",
      });
    }
  }

  if (sites.status === "fulfilled") {
    for (const site of (sites.value.data?.data ?? [])) {
      out.push({
        id: site.id,
        category: "Facilities",
        title: site.name,
        subtitle: [site.type, site.status].filter(Boolean).join(" · "),
        to: "/admin/sites",
      });
    }
  }

  if (customers.status === "fulfilled") {
    for (const c of (customers.value.data?.data ?? [])) {
      out.push({
        id: c.id,
        category: "Companies",
        title: c.name,
        subtitle: [c.industry, c.status].filter(Boolean).join(" · "),
        to: "/admin/customers",
      });
    }
  }

  return out;
}

export function GlobalSearch({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try { setResults(await runSearch(q)); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const grouped    = groupByCategory(results);
  const hasResults = results.length > 0;

  return (
    <div ref={wrapRef} className="relative flex-1 max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault(); setOpen(false); onOpenPalette();
          }
        }}
        placeholder="Search audits, incidents, facilities…"
        className="h-10 w-full rounded-lg border border-border/60 bg-card/60 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary/60 focus:bg-card"
      />
      <button
        type="button"
        onClick={onOpenPalette}
        className="absolute right-2 top-1/2 hidden h-6 -translate-y-1/2 items-center gap-1 rounded border border-border/60 bg-muted px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
        aria-label="Open command palette"
      >
        ⌘K
      </button>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : hasResults ? (
              (Object.keys(grouped) as SearchCategory[]).map((cat) => {
                const items = grouped[cat];
                if (!items.length) return null;
                const Icon = ICONS[cat];
                return (
                  <div key={cat} className="mb-2">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        to={item.to as any}
                        onClick={() => { setOpen(false); setQuery(""); }}
                        className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent")}
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-inset ring-border">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                );
              })
            ) : (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">No results for "{query}"</p>
            )}
          </div>
          <div className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            Press <kbd className="rounded border border-border/60 bg-muted px-1">⌘K</kbd> for the command palette
          </div>
        </div>
      )}
    </div>
  );
}
