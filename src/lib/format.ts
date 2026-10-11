import i18n, { LANGUAGES, currentLanguage } from "@/i18n";

const locale = () => LANGUAGES[currentLanguage()].intl;
const CURRENCY_CODE = /^[A-Z]{3}$/;

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale(), options).format(value);
}

/** نسبة بإشارة صريحة: +12.5% أو -3% — و`null` يعني «لا مقارنة» فيُعرض شرطة. */
export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${formatNumber(value, {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  })}%`;
}

/**
 * المبلغ بعملته. الرمز الذي لا يطابق ISO يُعرض نصاً بجانب الرقم، لأن
 * `Intl` يرفض الرموز الغريبة برمي خطأ.
 */
export function formatMoney(amount: number, currency: string): string {
  if (CURRENCY_CODE.test(currency)) {
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  const digits = formatNumber(amount, { maximumFractionDigits: 0 });
  return currency ? `${digits} ${currency}` : digits;
}

/**
 * يوم بصيغة `YYYY-MM-DD` دون انزياح التوقيت: نقرأه بالتوقيت العالمي، فلا يتحوّل
 * منتصف الليل إلى اليوم السابق في المناطق الغربية.
 */
export function formatDay(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  if (!year || !month || !day) return isoDay;
  return new Intl.DateTimeFormat(locale(), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, day));
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** دقائق الانتظار بصيغة مقروءة: «٤٥ دقيقة» أو «ساعة و٥ دقائق». */
export function formatWait(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) {
    return i18n.t("common.minutes", { count: total });
  }
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest
    ? i18n.t("common.hoursMinutes", { hours, minutes: rest })
    : i18n.t("common.hours", { count: hours });
}
