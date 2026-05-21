import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw, Users, UserCheck, UserX, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { userService, type User } from "@/lib/api/services/user.service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FilterBar } from "@/components/shared/FilterBar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Team Â· 360CRD" }] }),
  component: UsersPage,
});

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "bg-green-500/10 text-green-600 border-green-500/20",
  INACTIVE:  "bg-gray-500/10 text-gray-600 border-gray-500/20",
  SUSPENDED: "bg-red-500/10 text-red-600 border-red-500/20",
  INVITED:   "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const FILTER_CONFIGS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "INVITED", label: "Invited" },
      { value: "INACTIVE", label: "Inactive" },
      { value: "SUSPENDED", label: "Suspended" },
    ],
  },
];

function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVals, setFilterVals] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await userService.list({ limit: 100 });
      setUsers(res.data ?? []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      if (q && !u.firstName.toLowerCase().includes(q) && !u.lastName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (filterVals.status && filterVals.status !== "ALL" && u.status !== filterVals.status) return false;
      return true;
    });
  }, [users, search, filterVals]);

  const pills = [
    { label: "Total Users", value: users.length, icon: Users, color: "text-foreground" },
    { label: "Active", value: users.filter((u) => u.status === "ACTIVE").length, icon: UserCheck, color: "text-green-500" },
    { label: "Invited", value: users.filter((u) => u.status === "INVITED").length, icon: UserX, color: "text-blue-500" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px] space-y-5 animate-in fade-in duration-300">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Team</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage users, roles and access permissions.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button
              size="sm"
              className="gap-2 [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> Invite User
            </Button>
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
          searchPlaceholder="Search usersâ€¦"
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
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm font-medium">No users found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || Object.values(filterVals).some((v) => v && v !== "ALL")
                ? "Try adjusting filters"
                : "Invite your first team member"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="hidden md:table-cell text-xs">Email</TableHead>
                  <TableHead className="hidden lg:table-cell text-xs">Job Title</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs">Roles</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className="border-border/60 cursor-pointer hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {user.firstName[0]}{user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.firstName} {user.lastName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_COLOR[user.status] ?? "bg-gray-500/10 text-gray-600")}>
                        {user.status}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{user.jobTitle ?? "â€”"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.slice(0, 2).map((r) => (
                          <Badge key={r.id} variant="outline" className="text-[10px] px-1.5 py-0">{r.name}</Badge>
                        ))}
                        {user.roles.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{user.roles.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

