import { useTranslation } from "react-i18next";
import { Store } from "lucide-react";
import { useSession } from "@/features/auth/session-store";
import { currentLanguage } from "@/i18n";
import { localizedName } from "@/lib/localized";

/**
 * صفحة الترحيب: بطاقة بالاسم والفرع والأدوار وتلميح قصير. التنقل بين الصفحات يتم من القائمة
 * الجانبية، وشعار القائمة يعود إلى هذه الصفحة.
 */
export function WelcomePage() {
  const { t } = useTranslation();
  const language = currentLanguage();
  const user = useSession((state) => state.user);

  const displayName = user?.name || user?.email || t("welcome.guest");
  const branchName = localizedName(user?.branch ?? null, language);
  const roles = user?.roles ?? [];
  const hasPermissions = (user?.abilityRules.length ?? 0) > 0;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <section className="w-full max-w-md space-y-5 rounded-3xl border border-line bg-surface p-6 text-center shadow-sm sm:p-10">
        <img src="/logo.png" alt="" className="mx-auto h-14 w-auto" />
        <p className="text-xs tracking-wide text-muted">{t("app.name")}</p>

        <h1 className="text-2xl font-bold leading-relaxed text-ink">
          {t("welcome.hello")} <span className="text-secondary">{displayName}</span>
        </h1>

        {branchName && (
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-canvas px-4 py-1.5 text-sm font-semibold text-ink-soft">
            <Store className="size-4 text-primary" aria-hidden />
            {branchName}
          </p>
        )}

        {roles.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {roles.map((role) => (
              <span key={role} className="rounded-md bg-primary-soft px-2.5 py-1 text-xs font-medium text-ink-soft">
                {role}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm leading-7 text-muted">
          {hasPermissions ? t("welcome.hintWithMenu") : t("welcome.hintNoPermissions")}
        </p>
      </section>
    </div>
  );
}
