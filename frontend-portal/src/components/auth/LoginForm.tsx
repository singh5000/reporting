import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { z } from "zod";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import { InputField } from "@/components/shared/InputField";
import { Button } from "@/components/shared/Button";
import { authStore } from "@/lib/auth-store";
import { brandingStore } from "@/lib/stores/branding.store";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

type Errors = Partial<Record<"email" | "password" | "form", string>>;

const DEMO_CUSTOMER = {
  label: "Customer",
  badge: "portal",
  email: "customer@demo-corp.com",
  password: "Customer@360!",
  tenantSlug: "demo-corp",
  color: "bg-gray-500/10 text-gray-600 border-gray-500/20 hover:border-gray-500/50 hover:bg-gray-500/15",
};

export function LoginForm() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" }) as { redirect?: string };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const data = await authStore.login(parsed.data.email, parsed.data.password);
      const role = data.user?.roles?.[0] ?? data.user?.type ?? "";
      if (role !== "customer") {
        await authStore.logout();
        setErrors({ form: "Access denied. This portal is for customers only." });
        return;
      }
      brandingStore.invalidate();
      brandingStore.fetch();
      navigate({ to: (search.redirect?.startsWith("/portal") ? search.redirect : "/portal/dashboard") as any });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Unable to sign in. Please try again.";
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  const onDemoLogin = async () => {
    setDemoLoading(true);
    setErrors({});
    setEmail(DEMO_CUSTOMER.email);
    setPassword(DEMO_CUSTOMER.password);
    try {
      await authStore.login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password, DEMO_CUSTOMER.tenantSlug);
      brandingStore.invalidate();
      brandingStore.fetch();
      navigate({ to: "/portal/dashboard" as any });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Demo login failed. Please try again.";
      setErrors({ form: msg });
    } finally {
      setDemoLoading(false);
    }
  };

  const busy = loading || demoLoading;

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <InputField
          label="Email"
          type="email"
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          disabled={busy}
        />
        <InputField
          label="Password"
          type="password"
          autoComplete="current-password"
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          disabled={busy}
        />

        <div className="flex items-center justify-end pt-1">
          <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        {errors.form && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            {errors.form}
          </div>
        )}

        <Button
          type="submit"
          disabled={busy}
          className="h-11 w-full [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110 disabled:opacity-70"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
          ) : (
            <>Sign In <ArrowRight className="ml-1.5 h-4 w-4" /></>
          )}
        </Button>
      </form>

      <div>
        <div className="relative flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">Quick demo access</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <div className="mt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onDemoLogin}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-all disabled:opacity-50 ${DEMO_CUSTOMER.color}`}
          >
            <span>{DEMO_CUSTOMER.label}</span>
            {demoLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-60 ring-1 ring-current/30">
                {DEMO_CUSTOMER.badge}
              </span>
            )}
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/50">
          Demo data — no real incidents or records
        </p>
      </div>
    </div>
  );
}
