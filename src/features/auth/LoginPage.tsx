import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { LanguageSwitch } from "@/components/ui/LanguageSwitch";
import { AppSplash } from "@/components/ui/States";
import { ApiError, fieldMessage, toApiError } from "@/lib/http/errors";
import { useSession } from "./session-store";

export function LoginPage() {
  const { t } = useTranslation();
  const status = useSession((state) => state.status);
  const signIn = useSession((state) => state.signIn);
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // مفعّل افتراضياً كما في الداشبورد القديم: تبقى الجلسة 30 يوماً على الجهاز.
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);

  if (status === "unknown") return <AppSplash />;
  if (status === "authenticated") return <Navigate to={from} replace />;

  const canSubmit = email.trim() !== "" && password !== "" && !submitting;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await signIn(email.trim(), password, remember);
    } catch (caught) {
      setError(toApiError(caught, t("errors.unexpected")));
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-5">
      {/* خلفية الهوية النقشية، مغطاة بالكريمي ليبقى النص واضحاً. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[url('/pattern.jpg')] bg-cover bg-center opacity-40"
      />
      <div aria-hidden className="absolute inset-0 bg-canvas/70" />

      <div className="absolute end-5 top-5 z-10">
        <LanguageSwitch />
      </div>

      <main className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-line bg-surface p-8 shadow-[0_20px_60px_-20px_rgba(63,62,60,0.35)] sm:p-10">
          <div className="-mt-20 mb-6 flex justify-center">
            <div className="grid size-28 place-items-center rounded-full bg-surface shadow-[0_10px_30px_-10px_rgba(63,62,60,0.4)] ring-8 ring-canvas transition hover:scale-[1.03]">
              <img src="/logo.png" alt={t("auth.logoAlt")} className="h-16 w-auto" />
            </div>
          </div>

          <header className="mb-8 space-y-2 text-center">
            <h1 className="text-2xl font-bold text-ink">{t("auth.title")}</h1>
            <p className="text-sm text-muted">{t("auth.subtitle")}</p>
          </header>

          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {error && !error.fieldErrors.email && !error.fieldErrors.password && (
              <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                {error.message}
              </p>
            )}

            <Input
              label={t("auth.email")}
              type="email"
              name="email"
              autoComplete="username"
              dir="ltr"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldMessage(error, "email")}
            />

            <Input
              label={t("auth.password")}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldMessage(error, "password")}
              adornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                  className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-ink-soft">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="size-4 cursor-pointer accent-secondary"
                />
                {t("auth.rememberMe")}
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="cursor-pointer font-semibold text-secondary hover:underline"
              >
                {t("auth.forgotPassword")}
              </button>
            </div>

            <Button type="submit" disabled={!canSubmit} className="w-full bg-primary text-ink hover:bg-primary/90">
              {submitting ? t("auth.signingIn") : t("auth.submit")}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-ink-soft">{t("app.name")} · {t("app.subtitle")}</p>
        {forgotOpen && (
          <Dialog
            open
            onClose={() => setForgotOpen(false)}
            title={t("auth.forgotTitle")}
            footer={
              <Button onClick={() => setForgotOpen(false)} className="bg-secondary text-white hover:bg-secondary/90">
                {t("auth.ok")}
              </Button>
            }
          >
            <p className="text-sm leading-7 text-ink-soft">{t("auth.forgotMessage")}</p>
          </Dialog>
        )}
      </main>
    </div>
  );
}
