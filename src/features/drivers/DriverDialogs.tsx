import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Navigation, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Bars";
import { ErrorState } from "@/components/ui/States";
import { DeliveryFailureFields } from "@/features/orders/deliveryFailure";
import { failureIsComplete } from "@/features/orders/failureReasons";
import { toText } from "@/lib/coerce";
import { formatDateTime } from "@/lib/format";
import type { Named } from "@/services";
import { amountOf, customerOf, isCardPayment, refOf } from "./orderFields";

/** تفاصيل الطلب للقراءة فقط، من `driver/orders/{id}`: الزبون والمبلغ، ثم سجل الطلب بأوقاته. */
export function OrderDetailsDialog({
  order,
  loading,
  onClose,
}: {
  order: Named | null;
  loading: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open onClose={onClose} size="md" title={order ? refOf(order) : t("drivers.details.title")}>
      {!order ? (
        loading ? (
          <Skeleton className="h-48" />
        ) : (
          <ErrorState message={t("errors.unexpected")} />
        )
      ) : (
        <DetailsBody order={order} />
      )}
    </Dialog>
  );
}

function DetailsBody({ order }: { order: Named }) {
  const { t } = useTranslation();
  const customer = customerOf(order);
  const phone = toText(customer.phone);
  const mapUrl = toText(order.maps_url);
  const notes = toText(order.notes);
  const failed = toText(order.status) === "delivery_failed";
  const failureReason = toText(order.delivery_failed_reason);
  const failureNote = toText(order.delivery_failed_note);

  const events = [
    { key: "assigned", label: t("drivers.details.assignedAt"), at: toText(order.assigned_at) },
    { key: "picked", label: t("drivers.details.pickedUpAt"), at: toText(order.picked_up_at) },
    failed
      ? { key: "failed", label: t("drivers.details.failedAt"), at: toText(order.delivery_failed_at) }
      : { key: "delivered", label: t("drivers.details.deliveredAt"), at: toText(order.delivered_at) },
  ];

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl bg-canvas p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-ink">{toText(customer.name) || "—"}</p>
          {phone && (
            <a
              href={`tel:${phone}`}
              dir="ltr"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-ok-soft px-3.5 text-sm font-semibold text-ok"
            >
              <Phone className="size-4" aria-hidden />
              <span className="tabular-nums">{phone}</span>
            </a>
          )}
        </div>
        <p className="text-sm leading-6 text-ink-soft">{toText(order.delivery_address) || "—"}</p>
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface transition hover:bg-ink-soft"
          >
            <Navigation className="size-4" aria-hidden />
            {t("drivers.card.navigate")}
          </a>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">{t("drivers.details.amount")}</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">{amountOf(order)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">{t("drivers.details.payment")}</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {isCardPayment(order) ? t("orderInvoice.card") : t("orderInvoice.cash")}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">{t("drivers.timeline.title")}</h3>
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.key} className="flex items-center gap-3">
              <span
                aria-hidden
                className={clsx(
                  "size-3 shrink-0 rounded-full",
                  event.at ? (event.key === "failed" ? "bg-danger" : "bg-ok") : "bg-line"
                )}
              />
              <span className="flex-1 text-sm text-ink-soft">{event.label}</span>
              <span className="text-sm tabular-nums text-ink">
                {event.at ? formatDateTime(event.at) : "—"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {failed && (failureReason || failureNote) && (
        <section className="space-y-1 rounded-xl bg-danger-soft p-4 text-sm">
          {failureReason && (
            <p className="font-semibold text-danger">
              {t(`deliveryFailure.reasons.${failureReason}`, { defaultValue: failureReason })}
            </p>
          )}
          {failureNote && <p className="text-ink-soft">{failureNote}</p>}
        </section>
      )}

      {notes && (
        <section className="rounded-xl border border-line p-4 text-sm">
          <p className="mb-1 text-xs text-muted">{t("drivers.details.notes")}</p>
          <p className="text-ink-soft">{notes}</p>
        </section>
      )}
    </div>
  );
}

/** تأكيد التسليم قبل إرساله. يذكّر السائق بالمبلغ الذي يحصّله نقداً، لأن الكبسة الثانية تُرفض برمز `not_on_the_way`. */
export function DeliveredDialog({
  order,
  busy,
  onConfirm,
  onClose,
}: {
  order: Named;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={t("drivers.confirm.deliveredTitle")}
      description={t("drivers.confirm.deliveredText", { ref: refOf(order) })}
    >
      <div className="space-y-5">
        <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm font-medium text-ink">
          {isCardPayment(order)
            ? t("drivers.confirm.cardPaid")
            : t("drivers.confirm.collectCash", { amount: amountOf(order) })}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t("drivers.confirm.back")}
          </Button>
          <Button disabled={busy} onClick={onConfirm}>
            {busy ? t("crud.saving") : t("drivers.confirm.deliveredOk")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** تعذّر التسليم: السبب إجباري، والملاحظة إجبارية مع «سبب آخر». */
export function FailedDialog({
  order,
  busy,
  onSubmit,
  onClose,
}: {
  order: Named;
  busy: boolean;
  onSubmit: (reason: string, note: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const ready = failureIsComplete(reason, note);

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={t("drivers.failed.title")}
      description={t("drivers.failed.description", { ref: refOf(order) })}
    >
      <div className="space-y-5">
        <DeliveryFailureFields
          reason={reason}
          note={note}
          onReasonChange={setReason}
          onNoteChange={setNote}
          disabled={busy}
        />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {t("drivers.confirm.back")}
          </Button>
          <Button variant="danger" disabled={busy || !ready} onClick={() => onSubmit(reason, note.trim())}>
            {busy ? t("crud.saving") : t("drivers.failed.submit")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
