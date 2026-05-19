import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { z } from "zod";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { InputField } from "@/components/shared/InputField";
import { Button } from "@/components/shared/Button";
import { authStore } from "@/lib/auth-store";

const schema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

type Errors = Partial<Record<"email" | "password" | "form", string>>;

export function LoginForm() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" }) as { redirect?: string };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

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
      await authStore.login(parsed.data.email, parsed.data.password);
      navigate({ to: search.redirect ?? "/dashboard" });
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
    const demoEmail = "admin@demo-corp.com";
    const demoPassword = "Demo@360!";
    setErrors({});
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    try {
      await authStore.login(demoEmail, demoPassword);
      navigate({ to: search.redirect ?? "/dashboard" });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Unable to start demo. Please try again.";
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <InputField
        label="Work email"
        type="email"
        autoComplete="email"
        icon={<Mail className="h-4 w-4" />}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        disabled={loading}
      />
      <InputField
        label="Password"
        type="password"
        autoComplete="current-password"
        icon={<Lock className="h-4 w-4" />}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        disabled={loading}
      />

      <div className="flex items-center justify-between pt-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded border border-border bg-card/50 transition-colors checked:border-primary checked:bg-primary"
            />
            <svg
              viewBox="0 0 16 16"
              className="pointer-events-none relative h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 8.5 6.5 12 13 4.5" />
            </svg>
          </span>
          Remember me for 30 days
        </label>
        <a href="#" className="text-xs font-medium text-primary hover:underline">
          Forgot password?
        </a>
      </div>

      {errors.form && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          {errors.form}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="h-11 w-full [background:var(--gradient-primary)] text-primary-foreground hover:brightness-110 disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Login to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
          </>
        )}
      </Button>

      <button
        type="button"
        onClick={onDemoLogin}
        disabled={loading}
        className="group flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 text-sm font-medium text-foreground transition-all hover:border-primary/70 hover:bg-primary/10 disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
        Try the one-click demo
      </button>
    </form>
  );
}
