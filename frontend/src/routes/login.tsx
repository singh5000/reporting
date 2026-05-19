import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { APP_NAME } from "@/lib/constants";
import { authStore } from "@/lib/auth-store";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
  }),
  beforeLoad: ({ search }) => {
    if (authStore.getState().isAuthenticated) {
      throw redirect({ to: search.redirect });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in · 360CRD" },
      { name: "description", content: "Sign in to your 360CRD workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, color-mix(in oklab, var(--color-primary) 18%, transparent), transparent 55%), radial-gradient(circle at 80% 90%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 50%)",
        }}
      />
      <div className="w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl [background:var(--gradient-primary)]">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div className="rounded-2xl border border-border/60 p-7 [background:var(--gradient-card)] [box-shadow:var(--shadow-elevated)] sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Sign in to your workspace
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your credentials to access the audit console.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protected by SOC 2 · ISO 27001 controls
        </p>
      </div>
    </div>
  );
}
