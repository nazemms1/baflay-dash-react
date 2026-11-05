import { useTranslation } from "react-i18next";
import { Banknote, Clock, CreditCard, Eye, MapPin, Navigation, Phone, Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { serverLabelOf } from "@/features/orders/orderStatus";
import { currentLanguage } from "@/i18n";
import { toText } from "@/lib/coerce";
import { formatDateTime } from "@/lib/format";
import type { Named } from "@/services";
import { DeliveryProgress } from "./DeliveryProgress";
import { amountOf, customerOf, isCardPayment, refOf } from "./orderFields";
import { branchPickupPoint, directionsUrl } from "./pickupPoint";

export interface DriverActions {
  pickup: boolean;
  delivered: boolean;
  failed: boolean;
}

interface DriverOrderCardProps {
  order: Named;
  actions: DriverActions;
  busy: boolean;
  onDetails: (() => void) | null;
  onPickup: () => void;
  onDeliver: () => void;
  onFail: () => void;
}

/**
 * كرت الطلب للسائق، مصمَّم للهاتف: المسار أعلاه، ثم الزبون بزر اتصال كبير، ثم العنوان
 * والمبلغ وزر الاتجاهات، وأسفله الخطوة التالية بزر واحد واضح. الأزرار تظهر حسب ما يسمح به الخادم.
 */
export function DriverOrderCard({ order, actions, busy, onDetails, onPickup, onDeliver, onFail }: DriverOrderCardProps) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const current = toText(order.status);
  const customer = customerOf(order);
  const phone = toText(customer.phone);
  const mapUrl = toText(order.maps_url);
  const failureReason = toText(order.delivery_failed_reason);
  const cardPaid = isCardPayment(order);
  const showFooter = actions.pickup || actions.delivered || actions.failed || onDetails !== null;
  const pickupPoint = branchPickupPoint(order);

  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p dir="ltr" className="font-mono text-lg font-bold text-ink">
            {refOf(order)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            <span>
              {t("drivers.card.assignedAt")} {formatDateTime(toText(order.assigned_at) || null)}
            </span>
          </p>
        </div>
        <StatusBadge status={current} label={serverLabelOf(order, current, language)} />
      </header>

      <DeliveryProgress order={order} />

      <div className="space-y-3 rounded-xl bg-canvas p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate font-semibold text-ink">{toText(customer.name) || "—"}</p>
          {phone && (
            <a
              href={`tel:${phone}`}
              dir="ltr"
              aria-label={`${t("drivers.card.call")} ${phone}`}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-ok-soft px-3.5 text-sm font-semibold text-ok transition hover:opacity-90"
            >
              <Phone className="size-4 shrink-0" aria-hidden />
              <span className="tabular-nums">{phone}</span>
            </a>
          )}
        </div>
        <p className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
          <MapPin className="mt-1 size-4 shrink-0 text-secondary" aria-hidden />
          <span>{toText(order.delivery_address) || "—"}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-ink">
            {cardPaid ? <CreditCard className="size-5" aria-hidden /> : <Banknote className="size-5" aria-hidden />}
          </span>
          <div>
            <p className="text-xs text-muted">{cardPaid ? t("orderInvoice.card") : t("orderInvoice.cash")}</p>
            <p className="text-lg font-bold tabular-nums text-ink">{amountOf(order)}</p>
          </div>
        </div>
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink transition hover:border-primary hover:bg-primary-soft"
          >
            <Navigation className="size-4" aria-hidden />
            {t("drivers.card.navigate")}
          </a>
        )}
      </div>

      {/* قبل الاستلام يحتاج السائق نقطة الفرع، وهي نقطة الاستلام الخاصة إن وُجدت. */}
      {actions.pickup && pickupPoint && (
        <a
          href={directionsUrl(pickupPoint)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink transition hover:border-primary hover:bg-primary-soft"
        >
          <Store className="size-4" aria-hidden />
          {t("drivers.card.navigateBranch")}
        </a>
      )}

      {current === "delivery_failed" && failureReason && (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {t(`deliveryFailure.reasons.${failureReason}`, { defaultValue: failureReason })}
        </p>
      )}

      {showFooter && (
        <footer className="mt-auto flex items-center gap-2 pt-1">
          {actions.pickup && (
            <Button className="flex-1" disabled={busy} onClick={onPickup}>
              {t("drivers.actions.pickup")}
            </Button>
          )}
          {actions.delivered && (
            <Button className="flex-1" disabled={busy} onClick={onDeliver}>
              {t("drivers.actions.delivered")}
            </Button>
          )}
          {actions.failed && (
            <Button variant="danger" className="flex-1" disabled={busy} onClick={onFail}>
              {t("drivers.actions.failed")}
            </Button>
          )}
          {onDetails && (
            <button
              type="button"
              aria-label={t("drivers.card.details")}
              title={t("drivers.card.details")}
              disabled={busy}
              onClick={onDetails}
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-soft ring-1 ring-line transition hover:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Eye className="size-5" aria-hidden />
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
