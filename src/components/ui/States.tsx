import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Inbox, ShieldAlert } from "lucide-react";
import { isForbidden } from "@/lib/http/errors";
import { returnToLogin } from "@/lib/http/forbidden";
import { Button } from "./Button";

/** حالة فارغة لا تترك الشاشة بيضاء: تشرح لماذا لا توجد بيانات. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted">
      <Inbox className="size-6 text-line" aria-hidden />
      <p>{children}</p>
    </div>
  );
}

/** المستخدم لا يملك صلاحية هذه الشاشة أو هذا الإجراء: رسالة مترجمة وزر يعيده إلى تسجيل الدخول. */
export function ForbiddenState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <ShieldAlert className="size-6 text-secondary" aria-hidden />
      <p className="text-sm text-ink-soft">{t("errors.forbidden")}</p>
      <Button variant="secondary" size="sm" onClick={returnToLogin}>
        {t("errors.backToLogin")}
      </Button>
    </div>
  );
}

export function ErrorState({ message, onRetry, error }: { message: string; onRetry?: () => void; error?: unknown }) {
  if (isForbidden(error)) return <ForbiddenState />;
  return <ErrorMessage message={message} onRetry={onRetry} />;
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <AlertTriangle className="size-6 text-danger" aria-hidden />
      <p className="text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

/**
 * شاشة البداية الكاملة، عند التحقق من الجلسة قبل عرض التطبيق: الشعار في المنتصف تحيط به
 * حلقة هادئة، وتحته نص قصير.
 */
export function AppSplash() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas"
    >
      <div className="relative grid size-24 place-items-center">
        <span aria-hidden className="animate-ring-expand absolute inset-0 rounded-full bg-primary/40" />
        <span aria-hidden className="animate-ring-expand absolute inset-0 rounded-full bg-primary/30 [animation-delay:0.6s]" />
        <img src="/logo.png" alt={t("app.name")} className="relative size-16 animate-logo-breathe object-contain" />
      </div>
      <p className="text-sm text-muted">{t("common.loading")}</p>
    </div>
  );
}
