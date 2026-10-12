import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/Button";

interface ErrorViewProps {
  title: string;
  message: string;
  hint?: string;
  /** في الصفحة الكاملة تملأ الشاشة، وداخل الإطار تحل محل الصفحة وحدها فتبقى القائمة الجانبية. */
  fullPage?: boolean;
}

/**
 * رسالة خطأ بهوية التطبيق: عنوان واضح وشرح قصير وزران للخروج منها، دون تفاصيل تقنية للمستخدم.
 */
function ErrorView({ title, message, hint, fullPage = false }: ErrorViewProps) {
  const { t } = useTranslation();
  const Heading = fullPage ? "h1" : "h2";

  return (
    <div
      role="alert"
      className={clsx("flex items-center justify-center p-4", fullPage ? "min-h-screen bg-canvas" : "py-16")}
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-secondary">
          <AlertTriangle className="size-7" aria-hidden />
        </span>
        <Heading className="mt-5 text-lg font-bold text-ink">{title}</Heading>
        <p className="mt-2 text-sm leading-7 text-ink-soft">{message}</p>
        {hint && <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs leading-6 text-muted">{hint}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => window.location.reload()}>
            {t("errors.reload")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.location.assign("/")}>
            {t("errors.goHome")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** خطأ غير متوقع يملأ الشاشة، ويظهر حين يتعطل جزء من التطبيق لا يمكن إصلاحه من داخل الصفحة. */
export function RenderErrorScreen() {
  const { t } = useTranslation();
  return <ErrorView fullPage title={t("errors.boundaryTitle")} message={t("errors.boundaryMessage")} />;
}

/** خطأ داخل صفحة واحدة: يظهر داخل الإطار، والقائمة الجانبية تبقى تعمل للتنقل بعيداً عنه. */
export function PageErrorScreen() {
  const { t } = useTranslation();
  return <ErrorView title={t("errors.boundaryTitle")} message={t("errors.boundaryMessage")} />;
}

/** الإعداد ناقص، فلا يمكن استدعاء الخادم. التفاصيل التقنية تظهر للمطور في وضع التطوير فقط. */
export function ConfigErrorScreen() {
  const { t } = useTranslation();
  return (
    <ErrorView
      fullPage
      title={t("errors.configTitle")}
      message={t("errors.configMessage")}
      hint={import.meta.env.DEV ? t("errors.configDevHint") : undefined}
    />
  );
}
