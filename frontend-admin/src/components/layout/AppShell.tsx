import { AlertTriangle } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/lib/auth-store";
import { useTenantContext } from "@/lib/stores/tenant-context.store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { selectedTenantId } = useTenantContext();
  const showBanner = user?.role === "super_admin" && !selectedTenantId;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        {showBanner && (
          <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>No company selected —</strong> any records you create will not be visible to company managers.
              Use the <strong>company switcher</strong> in the top-left to select a company first.
            </span>
          </div>
        )}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
