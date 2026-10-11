import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/Input";
import { formatNumber } from "@/lib/format";
import type { Values } from "@/components/crud/types";
import { chargesByDistance, estimateDeliveryFee, numberOrNull } from "./deliveryFee";

/** المسافة الافتراضية للمعاينة، كما في الداشبورد القديم. */
const DEFAULT_DISTANCE = "3.34";

/**
 * معاينة رسوم التوصيل داخل نموذج الفرع: مسافة تُجرَّب، فتظهر الرسوم وتفصيلها كما يحسبها
 * الخادم، مع تنبيه إن لم يُحدَّد موقع الفرع أو كانت المسافة خارج النطاق.
 */
export function DeliveryPreview({ values }: { values: Values }) {
  const { t } = useTranslation();
  const [distanceText, setDistanceText] = useState(DEFAULT_DISTANCE);

  const base = numberOrNull(values.delivery_fee) ?? 0;
  const perKm = numberOrNull(values.delivery_price_per_km);
  const radius = numberOrNull(values.delivery_radius_km);
  const distance = numberOrNull(distanceText);
  const hasPin = numberOrNull(values.location_x) !== null && numberOrNull(values.location_y) !== null;
  const byDistance = chargesByDistance(perKm);

  // النطاق والتسعير بالمسافة كلاهما بلا معنى بدون إحداثيات الفرع.
  const needsPin = !hasPin && (byDistance || (radius ?? 0) > 0);
  const outOfRange = radius !== null && radius > 0 && distance !== null && distance > radius;
  const fee = estimateDeliveryFee(base, perKm, distance);

  const breakdown = byDistance
    ? t("deliveryPreview.breakdown", {
        base: formatNumber(base),
        km: Math.ceil(distance ?? 0),
        perKm: formatNumber(perKm ?? 0),
        total: formatNumber(fee),
      })
    : t("deliveryPreview.fixed", { fee: formatNumber(base) });

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-canvas/40 p-5">
      <h3 className="text-sm font-semibold text-ink">{t("deliveryPreview.title")}</h3>

      {needsPin && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{t("deliveryPreview.needsPin")}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("deliveryPreview.distance")}
          type="number"
          min="0"
          step="0.1"
          dir="ltr"
          value={distanceText}
          onChange={(event) => setDistanceText(event.target.value)}
        />
        <div className="rounded-xl bg-surface px-4 py-3">
          <p className="text-xs text-muted">{t("deliveryPreview.fee")}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">{formatNumber(fee)}</p>
        </div>
      </div>

      <p className="text-sm text-ink-soft tabular-nums">{breakdown}</p>

      {outOfRange && (
        <p className="text-sm text-danger">{t("deliveryPreview.outOfRange", { radius: formatNumber(radius ?? 0) })}</p>
      )}
    </section>
  );
}
