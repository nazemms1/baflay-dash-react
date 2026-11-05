import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Trash2 } from "lucide-react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { formatNumber } from "@/lib/format";
import {
  RADIUS_MAX,
  RADIUS_MIN,
  RADIUS_STEP,
  isRadiusDraft,
  parseRadius,
  radiusFromSlider,
} from "./deliveryRadius";

type Point = { lat: number; lng: number };

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
 * نطاق التوصيل: منزلق للاختيار السريع (من 0.1 بخطوة 0.1)، وخانة رقم لمن يريد قيمة بعينها مثل
 * 0.3 أو 1.25. الفارغ يعني بلا نطاق. ما يُكتب يبقى كما كُتب حتى الخروج من الخانة.
 */
function RadiusControl({ radius, onChange }: { radius: number | null; onChange: (km: number | null) => void }) {
  const { t } = useTranslation();
  // النص قيد الكتابة، كـ«1.» الذي لا يساوي رقماً كاملاً بعد. `null` يعني أن الخانة تعرض القيمة المحفوظة.
  const [draft, setDraft] = useState<string | null>(null);

  const saved = radius === null ? "" : String(radius);
  const shown = draft !== null && parseRadius(draft) === radius ? draft : saved;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-ink-soft">{t("crud.location.radius")}</span>
          <span className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={shown}
              placeholder="0.00"
              onChange={(event) => {
                const text = event.target.value;
                if (!isRadiusDraft(text)) return;
                setDraft(text);
                onChange(parseRadius(text));
              }}
              onBlur={() => setDraft(null)}
              className="h-11 w-28 rounded-xl border border-line bg-surface px-3.5 text-[15px] tabular-nums text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
            <span className="text-sm text-ink-soft">{t("crud.location.km")}</span>
          </span>
        </label>
        <p className="text-sm font-semibold tabular-nums text-ink">
          {radius === null
            ? t("crud.location.radiusNotSet")
            : `${formatNumber(radius, { maximumFractionDigits: 2 })} ${t("crud.location.km")}`}
        </p>
      </div>
      <input
        type="range"
        min={RADIUS_MIN}
        max={RADIUS_MAX}
        step={RADIUS_STEP}
        value={Math.max(radius ?? RADIUS_MIN, RADIUS_MIN)}
        onChange={(event) => {
          setDraft(null);
          onChange(radiusFromSlider(Number(event.target.value)));
        }}
        aria-label={t("crud.location.radius")}
        className="w-full cursor-pointer accent-secondary"
      />
    </div>
  );
}

/**
 * حقل الموقع بخريطتين. الأولى لموقع الفرع: النقر يضعه والسحب يعدّله. والثانية، إن مُرِّر
 * `onRadiusChange`، لنطاق التوصيل: تُرسم عليها دائرة، وتحتها المنزلق وخانة الرقم لتحديد قطرها.
 * علامة الخريطة الثانية مستقلة، فتحريكها لا يغيّر موقع الفرع. وما دامت بلا نقطة خاصة بها تُعرض
 * على موقع الفرع، و«إعادة إلى موقع الفرع» تمسح نقطتها. لا تُدخل الإحداثيات يدوياً.
 */
export function LocationField({
  label,
  lat,
  lng,
  radius,
  onChange,
  onRadiusChange,
  deliveryLat,
  deliveryLng,
  onDeliveryChange,
  error,
}: {
  label: string;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  onChange: (point: Point | null) => void;
  /** يُمرَّر للحقول التي لها نطاق توصيل فقط، فتظهر الخريطة الثانية وعناصر التحكم بالقطر. */
  onRadiusChange?: (km: number | null) => void;
  /** نقطة الخريطة الثانية، وتبقى منفصلة عن موقع الفرع. */
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  onDeliveryChange?: (point: Point | null) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const hasPoint = lat !== null && lng !== null;
  const hasOwnPoint =
    deliveryLat !== null && deliveryLat !== undefined && deliveryLng !== null && deliveryLng !== undefined;
  // ما دامت الخريطة الثانية بلا نقطة خاصة بها تقف على موقع الفرع، وتتبعه إن تحرّك.
  const areaLat = hasOwnPoint ? deliveryLat : lat;
  const areaLng = hasOwnPoint ? deliveryLng : lng;

  const clearButton = (text: string, onClear: () => void) => (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-secondary hover:bg-secondary-soft sm:h-8"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {text}
    </button>
  );

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-surface p-4">
      <section className="space-y-3">
        <SectionHeader
          // مع خريطة النطاق يكون لكل خريطة عنوانها، فلا يجمعهما عنوان الحقل المشترك.
          title={onRadiusChange ? t("crud.location.pointTitle") : label}
          hint={t("crud.location.hint")}
          action={hasPoint ? clearButton(t("crud.location.clear"), () => onChange(null)) : null}
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
            hint={t("crud.location.radiusHint")}
            action={
              hasOwnPoint && onDeliveryChange
                ? clearButton(t("crud.location.resetToBranch"), () => onDeliveryChange(null))
                : null
            }
          />
          <LocationPicker
            lat={areaLat ?? null}
            lng={areaLng ?? null}
            radiusKm={radius}
            refitOnRadius
            readOnly={!onDeliveryChange}
            onChange={onDeliveryChange ? (point) => onDeliveryChange(point) : undefined}
          />
          <p className="text-xs text-muted tabular-nums" dir="ltr">
            {hasOwnPoint
              ? `${deliveryLat.toFixed(6)}, ${deliveryLng.toFixed(6)}`
              : hasPoint
                ? t("crud.location.areaSameAsBranch")
                : t("crud.location.notSet")}
          </p>
          <RadiusControl radius={radius} onChange={onRadiusChange} />
        </section>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
