import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ChevronsLeft, LogOut, Moon, ShieldCheck, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE, navItems } from "@/lib/constants";
import { authStore } from "@/lib/auth-store";
import { themeStore, useTheme } from "@/lib/theme-store";
import { useRole } from "@/lib/role-store";
import { canAccessResource, type Resource } from "@/lib/rbac";

const navResourceMap: Record<string, Resource> = {
  "/audits": "audits",
  "/incidents": "incidents",
  "/facilities": "facilities",
  "/companies": "companies",
  "/settings": "settings",
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const theme = useTheme();
  const role = useRole();
  const visibleNav = navItems.filter((item) => {
    const resource = navResourceMap[item.to];
    if (!resource) return true;
    return canAccessResource(role, resource);
  });

  const handleLogout = () => {
    authStore.logout();
    navigate({ to: "/login", search: { redirect: "/dashboard" } });
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 md:flex",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [background:var(--gradient-primary)]">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{APP_NAME}</p>
              <p className="truncate text-[11px] text-muted-foreground">{APP_TAGLINE}</p>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            collapsed && "absolute right-[-12px] top-5 h-6 w-6 border border-sidebar-border bg-sidebar",
          )}
          aria-label="Toggle sidebar"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {!collapsed && (
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Workspace
          </p>
        )}
        {visibleNav.map((item) => {
          const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={cn("space-y-2 border-t border-sidebar-border p-3", collapsed && "px-2")}>
        <ThemeToggle collapsed={collapsed} theme={theme} onToggle={() => themeStore.toggle()} />
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
          aria-label="Sign out"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

function ThemeToggle({
  collapsed,
  theme,
  onToggle,
}: {
  collapsed: boolean;
  theme: "dark" | "light";
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 w-full items-center justify-center rounded-lg border border-sidebar-border text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-1"
      role="radiogroup"
      aria-label="Theme"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        onClick={() => theme !== "light" && onToggle()}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
          theme === "light"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="h-3.5 w-3.5" /> Light
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        onClick={() => theme !== "dark" && onToggle()}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
          theme === "dark"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="h-3.5 w-3.5" /> Dark
      </button>
    </div>
  );
}
