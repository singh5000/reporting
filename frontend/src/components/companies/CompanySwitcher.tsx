import { Building2, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  companyStore,
  useActiveCompanyId,
  useCompanies,
} from "@/lib/company-store";

export function CompanySwitcher() {
  const companies = useCompanies();
  const activeId = useActiveCompanyId();
  const active = companies.find((c) => c.id === activeId) ?? companies[0];

  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 text-sm transition-colors hover:bg-accent"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Building2 className="h-3.5 w-3.5" />
          </span>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="truncate text-xs font-medium leading-tight text-foreground">{active.name}</p>
            <p className="text-[10px] leading-tight text-muted-foreground">{active.plan}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Active company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => companyStore.setActive(c.id)}
            className="flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="text-[11px] text-muted-foreground">{c.industry} · {c.plan}</p>
            </div>
            {c.id === active.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
