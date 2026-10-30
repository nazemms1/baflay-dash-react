import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Trash2 } from "lucide-react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { formatNumber } from "@/lib/format";

/** حدود المنزلق لنطاق التوصيل بالكيلومتر. */
const RADIUS_MIN = 0.5;
const RADIUS_MAX = 20;
const RADIUS_STEP = 0.5;

/** يُقرّب النطاق المُحدَّد على الخريطة إلى خطوة المنزلق نفسها، ويُحصر في حدوده. */
function snapRadius(km: number) {
  const stepped = Math.round(km / RADIUS_STEP) * RADIUS_STEP;
  return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, stepped));
}

/** عنوان قسم الخريطة مع تلميحه، وإجراء اختياري يظهر بجانبه كزر الإزالة. */
function SectionHeader({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MapPin className="size-4 text-secondary" aria-hidden />
          {title}
        </p>
        <p className="mt-1 text-xs text-muted">{hint}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * حقل الموقع: خريطة لتحديد موقع الفرع، والنقر يضعه والسحب يعدّله. وإن مُرِّر
 * `onRadiusChange` تظهر خريطة ثانية لنطاق التوصيل بعنوانها الخاص، فالنقر عليها يضبط
 * النطاق بالمسافة من الفرع، والمنزلق للضبط الدقيق. لا تُدخل الإحداثيات يدوياً.
 */
export function LocationField({
  label,
  lat,
  lng,
  radius,
  onChange,
  onRadiusChange,
  error,
}: {
  label: string;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  onChange: (point: { lat: number; lng: number } | null) => void;
  /** يُمرَّر للحقول التي لها نطاق توصيل فقط، فتظهر الخريطة الثانية. */
  onRadiusChange?: (km: number | null) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const hasPoint = lat !== null && lng !== null;
  const radiusValue = radius ?? RADIUS_MIN;

  const clearButton = hasPoint ? (
    <button
      type="button"
      onClick={() => onChange(null)}
      className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-secondary hover:bg-secondary-soft sm:h-8"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {t("crud.location.clear")}
    </button>
  ) : null;

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-surface p-4">
      <section className="space-y-3">
        <SectionHeader
          // مع خريطة النطاق يكون لكل خريطة عنوانها، فلا يجمعهما عنوان الحقل المشترك.
          title={onRadiusChange ? t("crud.location.pointTitle") : label}
          hint={t("crud.location.hint")}
          action={clearButton}
        />
        <LocationPicker lat={lat} lng={lng} onChange={(point) => onChange(point)} />
        <p className="text-xs text-muted tabular-nums" dir="ltr">
          {hasPoint ? `${lat!.toFixed(6)}, ${lng!.toFixed(6)}` : t("crud.location.notSet")}
        </p>
      </section>

      {onRadiusChange && (
        <section className="space-y-3">
          <SectionHeader
            title={t("crud.location.radiusTitle")}
            hint={hasPoint ? t("crud.location.radiusHint") : t("crud.location.radiusNeedsPoint")}
          />
          <LocationPicker
            lat={lat}
            lng={lng}
            radiusKm={radiusValue}
            onRadiusChange={(km) => onRadiusChange(snapRadius(km))}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink-soft">{t("crud.location.radius")}</span>
              <span className="font-semibold tabular-nums text-ink">
                {formatNumber(radiusValue, { maximumFractionDigits: 1 })} {t("crud.location.km")}
              </span>
            </div>
            <input
              type="range"
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={RADIUS_STEP}
              value={radiusValue}
              onChange={(event) => onRadiusChange(Number(event.target.value))}
              aria-label={t("crud.location.radius")}
              className="w-full cursor-pointer accent-secondary"
            />
          </div>
        </section>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
