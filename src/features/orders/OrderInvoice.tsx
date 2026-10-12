import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Bars";
import { ErrorState } from "@/components/ui/States";
import { currentLanguage } from "@/i18n";
import { asRecord, toText } from "@/lib/coerce";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { orderAdmin, type Named } from "@/services";
import { StatusBadge } from "./StatusBadge";
import { serverLabelOf } from "./orderStatus";
import { toInvoiceModel } from "./invoiceModel";

/**
 * فاتورة الطلب: مستند واحد يصلح للشاشة والطباعة وملف PDF. الرأس بهوية المطعم ورقم الطلب، ثم بيانات
 * الزبون والطلب والتوصيل، ثم الأصناف والصلصات، ثم الحساب الختامي. أزرار الأدوات لا تُطبع.
 */
export function OrderInvoice({ record }: { record: Named }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const articleRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  // وقت الطباعة يُثبَّت عند فتح الفاتورة، فلا يتغير مع كل رسم.
  const [printedAt] = useState(() => new Date().toISOString());
  // تنزيل الفاتورة كملف PDF يحتاج صلاحية الفاتورة نفسها، لا صلاحية عرض الطلب.
  const canDownload = usePermissions().has("admin.orders.invoice");

  const invoice = useQuery({
    queryKey: ["order-invoice", record.id],
    queryFn: () => orderAdmin.invoice(record.id),
  });

  if (invoice.isPending) return <Skeleton className="h-96" />;
  if (invoice.isError) {
    return <ErrorState message={t("errors.unexpected")} onRetry={() => void invoice.refetch()} />;
  }

  const model = toInvoiceModel(invoice.data, record, language);
  const money = (amount: number) => formatMoney(amount, model.currency);
  const isDelivery = model.orderType === "delivery";

  const variantText = (variant: "sandwich" | "meal" | "custom") => {
    if (variant === "meal") return t("orderInvoice.meal");
    if (variant === "custom") return t("orderInvoice.custom");
    return t("orderInvoice.sandwich");
  };
  const orderTypeText = isDelivery ? t("orderInvoice.delivery") : t("orderInvoice.pickup");
  const paymentText = model.paymentMethod === "card" ? t("orderInvoice.card") : t("orderInvoice.cash");

  async function downloadPdf() {
    const element = articleRef.current;
    if (!element) return;
    setExporting(true);
    try {
      // المكتبة ثقيلة، فلا تُحمَّل إلا عند الطلب.
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf()
        .set({
          margin: 10,
          filename: `invoice-${model.orderNumber.replace(/[^\w-]+/g, "")}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();
    } catch {
      toast.error(t("orderInvoice.pdfFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          {t("orderInvoice.print")}
        </Button>
        <Button onClick={() => void downloadPdf()} disabled={exporting || !canDownload}>
          <Download className="size-4" aria-hidden />
          {exporting ? t("orderInvoice.preparingPdf") : t("orderInvoice.downloadPdf")}
        </Button>
      </div>

      <article
        ref={articleRef}
        id="print-area"
        className="mx-auto w-full max-w-[210mm] rounded-2xl border border-line bg-surface p-6 text-ink sm:p-8"
      >
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink pb-6">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="" className="size-16 object-contain" />
            <div>
              <p className="text-lg font-bold">{t("app.name")}</p>
              {model.branch && <p className="text-sm text-ink-soft">{model.branch}</p>}
            </div>
          </div>
          <div className="space-y-1 text-end">
            <p className="text-xs font-semibold text-muted">{t("orderInvoice.title")}</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{model.orderNumber}</p>
            <p className="text-sm tabular-nums text-ink-soft">{formatDateTime(model.createdAt || null)}</p>
            <div className="pt-1">
              <StatusBadge status={model.status} label={serverLabelOf(record, model.status, language)} />
            </div>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
          <Block title={t("orderInvoice.sectionCustomer")}>
            <p className="text-sm font-semibold">{model.customer || "—"}</p>
            {model.customerPhone && (
              <Row label={t("orderInvoice.customerPhone")} value={<span dir="ltr">{model.customerPhone}</span>} />
            )}
          </Block>

          <Block title={t("orderInvoice.sectionOrder")}>
            <Row label={t("orderInvoice.orderType")} value={orderTypeText} />
            <Row label={t("orderInvoice.payment")} value={paymentText} />
            <Row label={t("orderInvoice.currency")} value={model.currency || "—"} />
          </Block>

          {isDelivery && (
            <Block title={t("orderInvoice.sectionDelivery")}>
              <Row label={t("orderInvoice.address")} value={model.address || "—"} />
              {model.distanceKm !== null && (
                <Row
                  label={t("orderInvoice.distance")}
                  value={`${formatNumber(model.distanceKm, { maximumFractionDigits: 2 })} ${t("orderInvoice.km")}`}
                />
              )}
            </Block>
          )}
        </section>

        {isDelivery && <DeliveryTimeline record={record} />}

        {model.notes && (
          <section className="mt-6 rounded-xl border border-line p-4 text-sm">
            <p className="mb-1 text-xs font-semibold text-muted">{t("orderInvoice.notes")}</p>
            <p>{model.notes}</p>
          </section>
        )}

        <section className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold">{t("orderInvoice.items")}</h3>
          {model.lines.length === 0 ? (
            <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted print:bg-transparent">
              {t("orderInvoice.noItems")}
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-ink text-xs text-muted">
                  <th className="w-10 py-2 text-start font-semibold">#</th>
                  <th className="py-2 text-start font-semibold">{t("orderInvoice.colItem")}</th>
                  <th className="w-16 py-2 text-center font-semibold">{t("orderInvoice.colQty")}</th>
                  <th className="w-28 py-2 text-end font-semibold">{t("orderInvoice.colPrice")}</th>
                  <th className="w-28 py-2 text-end font-semibold">{t("orderInvoice.colTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {model.lines.map((line, index) => (
                  <tr key={line.key} className="break-inside-avoid border-b border-line align-top">
                    <td className="py-3 tabular-nums text-muted">{index + 1}</td>
                    <td className="py-3">
                      <div className="flex items-start gap-3">
                        {line.image && (
                          <img src={line.image} alt="" className="size-12 shrink-0 rounded-lg object-cover print:hidden" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold">{line.name}</p>
                          <p className="text-xs text-muted">{variantText(line.variant)}</p>
                          {line.addOns.map((addOn, addIndex) => (
                            <p key={addIndex} className="text-xs text-ink-soft tabular-nums">
                              + {addOn.name}
                              {addOn.quantity > 1 && ` ×${addOn.quantity}`} · {money(addOn.amount)}
                            </p>
                          ))}
                          {line.notes && <p className="text-xs text-muted">{line.notes}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center tabular-nums">{line.quantity}</td>
                    <td className="py-3 text-end tabular-nums">{money(line.unitPrice)}</td>
                    <td className="py-3 text-end font-semibold tabular-nums">{money(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {model.sauces.length > 0 && (
          <section className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold">{t("orderInvoice.sauces")}</h3>
            <table className="w-full border-collapse text-sm">
              <tbody>
                {model.sauces.map((sauce, index) => (
                  <tr key={sauce.key} className="break-inside-avoid border-b border-line">
                    <td className="w-10 py-2.5 tabular-nums text-muted">{index + 1}</td>
                    <td className="py-2.5">
                      {sauce.name}
                      {sauce.quantity > 1 && <span className="text-muted"> ×{sauce.quantity}</span>}
                    </td>
                    <td className="w-28 py-2.5 text-end font-semibold tabular-nums">{money(sauce.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mt-6 flex justify-end">
          <div className="w-full max-w-sm space-y-2 text-sm">
            <TotalRow label={t("orderInvoice.itemsSubtotal")} value={money(model.itemsSubtotal)} />
            {model.saucesTotal > 0 && <TotalRow label={t("orderInvoice.saucesTotal")} value={money(model.saucesTotal)} />}
            {(isDelivery || model.deliveryFee > 0) && (
              <TotalRow label={t("orderInvoice.deliveryFee")} value={money(model.deliveryFee)} />
            )}
            {model.discount > 0 && <TotalRow label={t("orderInvoice.discount")} value={`- ${money(model.discount)}`} />}
            <div className="flex items-center justify-between gap-3 border-y-2 border-ink py-3 text-base font-bold">
              <span>{t("orderInvoice.totalDue")}</span>
              <span className="text-xl tabular-nums">{money(model.totalDue)}</span>
            </div>
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
          <p>{t("orderInvoice.thanks")}</p>
          <p className="tabular-nums">{t("orderInvoice.printedAt", { date: formatDateTime(printedAt) })}</p>
        </footer>
      </article>
    </div>
  );
}

/** متابعة التوصيل: السائق وأوقات الإسناد والاستلام والتسليم، وسبب تعذّر التسليم إن وُجد، ورابط الخرائط للشاشة فقط. */
function DeliveryTimeline({ record }: { record: Named }) {
  const { t } = useTranslation();
  const driver = asRecord(record.driver);
  const driverName = toText(driver.name);
  const driverPhone = toText(driver.phone);
  const failureReason = toText(record.delivery_failed_reason);
  const failureNote = toText(record.delivery_failed_note);
  const mapUrl = toText(record.maps_url);

  return (
    <section className="mt-2 grid gap-6 border-t border-line pt-6 sm:grid-cols-2 lg:grid-cols-3">
      <Block title={t("orderInvoice.sectionTimeline")}>
        <Row
          label={t("drivers.details.driver")}
          value={driverName ? `${driverName}${driverPhone ? ` · ${driverPhone}` : ""}` : t("drivers.assign.none")}
        />
        <Row label={t("drivers.details.assignedAt")} value={formatDateTime(toText(record.assigned_at) || null)} />
        <Row label={t("drivers.details.pickedUpAt")} value={formatDateTime(toText(record.picked_up_at) || null)} />
        <Row label={t("drivers.details.deliveredAt")} value={formatDateTime(toText(record.delivered_at) || null)} />
      </Block>

      {failureReason && (
        <Block title={t("orderInvoice.sectionFailure")}>
          <Row
            label={t("drivers.details.failure")}
            value={t(`deliveryFailure.reasons.${failureReason}`, { defaultValue: failureReason })}
          />
          <Row label={t("drivers.details.failedAt")} value={formatDateTime(toText(record.delivery_failed_at) || null)} />
          {failureNote && <Row label={t("drivers.details.failureNote")} value={failureNote} />}
        </Block>
      )}

      {mapUrl && (
        <div className="print:hidden">
          <Block title={t("drivers.details.location")}>
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-secondary hover:underline">
              {t("drivers.card.openMap")}
            </a>
          </Block>
        </div>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="border-b border-line pb-1 text-xs font-semibold text-muted">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-end font-medium">{value}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-ink-soft">
      <span>{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}
