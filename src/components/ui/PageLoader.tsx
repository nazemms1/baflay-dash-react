import { useTranslation } from "react-i18next";
import { Skeleton } from "./Bars";

/**
 * هيكل الصفحة أثناء تحميل أجزائها: رأسها وشريط أدواتها وبطاقاتها، فيعرف المستخدم شكل ما سيظهر
 * بدل شاشة فارغة أو دائرة تدور.
 */
export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="space-y-6 animate-page-in">
      <span className="sr-only">{t("common.loading")}</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <Skeleton className="h-14 rounded-2xl" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-72 rounded-2xl lg:col-span-8" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-4" />
      </div>
    </div>
  );
}
