import { useTranslation } from "react-i18next";

/**
 * قيمة أُطلقت من حساب محذوف: تُعرض بلون باهت وبشارة «سابقاً» قبلها، كي لا تُقرأ بريداً أو
 * هاتفاً حيّاً يمكن التواصل معه.
 */
export function ReleasedValue({
  value,
  wasReleased,
  dir,
}: {
  value: string | null;
  wasReleased: boolean;
  dir?: "ltr" | "rtl";
}) {
  const { t } = useTranslation();
  if (!value) return <span className="text-muted">—</span>;

  return (
    <span dir={dir} className={wasReleased ? "text-muted" : undefined}>
      {wasReleased && (
        <span className="me-1.5 rounded bg-canvas px-1.5 py-px align-middle text-[10px] font-medium text-muted">
          {t("common.formerly")}
        </span>
      )}
      {value}
    </span>
  );
}
