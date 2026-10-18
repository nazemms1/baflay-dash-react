import { useTranslation } from "react-i18next";
import { MapPin, Trash2 } from "lucide-react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { formatNumber } from "@/lib/format";

/** حدود المنزلق لنطاق التوصيل بالكيلومتر. */
const RADIUS_MIN = 0.5;
const RADIUS_MAX = 20;
const RADIUS_STEP = 0.5;

/**
 * حقل الموقع: الخريطة هي وسيلة التحديد، فالنقر يضع الفرع، والسحب يعدّله،
 * والمنزلق يحدد نطاق التوصيل فتتغير الدائرة مباشرة. لا تُدخل الإحداثيات يدوياً.
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
  onRadiusChange: (km: number | null) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const hasPoint = lat !== null && lng !== null;
  const radiusValue = radius ?? RADIUS_MIN;

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <MapPin className="size-4 text-secondary" aria-hidden />
            {label}
          </p>
          <p className="mt-1 text-xs text-muted">{t("crud.location.hint")}</p>
        </div>
        {hasPoint && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-secondary hover:bg-secondary-soft sm:h-8"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t("crud.location.clear")}
          </button>
        )}
      </div>

      <LocationPicker
        lat={lat}
        lng={lng}
        radiusKm={radiusValue}
        onChange={(point) => onChange(point)}
      />

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
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
        <p className="text-xs text-muted tabular-nums" dir="ltr">
          {hasPoint ? `${lat!.toFixed(6)}, ${lng!.toFixed(6)}` : t("crud.location.notSet")}
        </p>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
