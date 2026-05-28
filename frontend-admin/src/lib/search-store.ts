export type SearchCategory = "Incidents" | "Audits" | "Facilities" | "Companies";

export type SearchItem = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string;
  to: string;
};

export function groupByCategory(items: SearchItem[]): Record<SearchCategory, SearchItem[]> {
  const out: Record<SearchCategory, SearchItem[]> = { Incidents: [], Audits: [], Facilities: [], Companies: [] };
  for (const it of items) out[it.category].push(it);
  (Object.keys(out) as SearchCategory[]).forEach((k) => { out[k] = out[k].slice(0, 5); });
  return out;
}
