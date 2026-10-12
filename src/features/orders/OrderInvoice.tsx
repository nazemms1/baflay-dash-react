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
import { formatDateTime, formatMoney } from "@/lib/format";
import { orderAdmin, type Named } from "@/services";
import { StatusBadge } from "./StatusBadge";
import { serverLabelOf } from "./orderStatus";
import { toInvoiceModel } from "./invoiceModel";

/**
 * فاتورة الطلب كما في الداشبورد القديم: رأس بالرقم والحالة والتاريخ، ثم بيانات الطلب، ثم جدول
 * الأصناف مع إضافاتها، ثم الصلصات، ثم الحساب الختامي. الطباعة تُظهر الفاتورة وحدها.
 */
export function OrderInvoice({ record }: { record: Named }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const articleRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
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
  const currency = model.currency;
  const money = (amount: number) => formatMoney(amount, currency);

  const variantText = (variant: "sandwich" | "meal" | "custom") => {
    if (variant === "meal") return t("orderInvoice.meal");
    if (variant === "custom") return t("orderInvoice.custom");
    return t("orderInvoice.sandwich");
  };
  const orderTypeText = model.orderType === "delivery" ? t("orderInvoice.delivery") : t("orderInvoice.pickup");
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          {t("orderInvoice.print")}
        </Button>
        <Button onClick={() => void downloadPdf()} disabled={exporting || !canDownload}>
          <Download className="size-4" aria-hidden />
          {exporting ? t("orderInvoice.preparingPdf") : t("orderInvoice.downloadPdf")}
        </Button>
      </div>

      <article ref={articleRef} id="print-area" className="space-y-6 rounded-2xl border border-line bg-surface p-6 text-ink">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <p className="text-xs text-muted">{t("orderInvoice.orderNo")}</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{model.orderNumber}</p>
          </div>
          <div className="space-y-2 text-end">
            <StatusBadge status={model.status} label={serverLabelOf(record, model.status, language)} />
            <p className="text-sm tabular-nums text-ink-soft">{formatDateTime(model.createdAt || null)}</p>
          </div>
        </header>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label={t("orderInvoice.customer")} value={model.customer || "—"} />
          <Info label={t("orderInvoice.branch")} value={model.branch || "—"} />
          <Info label={t("orderInvoice.orderType")} value={orderTypeText} />
          <Info label={t("orderInvoice.payment")} value={paymentText} />
          {model.orderType === "delivery" && (
            <Info label={t("orderInvoice.address")} value={model.address || "—"} wide />
          )}
          {model.orderType === "delivery" && <DeliveryDetails record={record} />}
          {model.notes && <Info label={t("orderInvoice.notes")} value={model.notes} wide />}
        </dl>

        <section className="space-y-3">
          <h3 className="font-semibold">{t("orderInvoice.items")}</h3>
          {model.lines.length === 0 ? (
            <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">{t("orderInvoice.noItems")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 text-start font-medium">{t("orderInvoice.colItem")}</th>
                    <th className="px-4 py-2 text-center font-medium">{t("orderInvoice.colQty")}</th>
                    <th className="px-4 py-2 text-end font-medium">{t("orderInvoice.colPrice")}</th>
                    <th className="px-4 py-2 text-end font-medium">{t("orderInvoice.colTotal")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {model.lines.map((line) => (
                    <tr key={line.key} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {line.image && (
                            <img src={line.image} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium">{line.name}</p>
                            <p className="text-xs text-muted">{variantText(line.variant)}</p>
                            {line.addOns.map((addOn, index) => (
                              <p key={index} className="text-xs text-ink-soft tabular-nums">
                                + {addOn.name}
                                {addOn.quantity > 1 && ` ×${addOn.quantity}`} · {money(addOn.amount)}
                              </p>
                            ))}
                            {line.notes && <p className="text-xs text-muted">{line.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{line.quantity}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{money(line.unitPrice)}</td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums">{money(line.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {model.sauces.length > 0 && (
          <section className="space-y-3">
            <h3 className="font-semibold">{t("orderInvoice.sauces")}</h3>
            <ul className="divide-y divide-line rounded-xl border border-line text-sm">
              {model.sauces.map((sauce) => (
                <li key={sauce.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span>
                    {sauce.name}
                    {sauce.quantity > 1 && ` ×${sauce.quantity}`}
                  </span>
                  <span className="tabular-nums">{money(sauce.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="ms-auto w-full max-w-sm space-y-2 text-sm">
          <SummaryRow label={t("orderInvoice.itemsSubtotal")} value={money(model.itemsSubtotal)} />
          {model.saucesTotal > 0 && <SummaryRow label={t("orderInvoice.saucesTotal")} value={money(model.saucesTotal)} />}
          {model.deliveryFee > 0 && <SummaryRow label={t("orderInvoice.deliveryFee")} value={money(model.deliveryFee)} />}
          {model.discount > 0 && <SummaryRow label={t("orderInvoice.discount")} value={`- ${money(model.discount)}`} />}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-ink">
            <span className="font-bold">{t("orderInvoice.totalDue")}</span>
            <span className="text-lg font-bold tabular-nums">{money(model.totalDue)}</span>
          </div>
        </section>
      </article>
    </div>
  );
}

/** مسار التوصيل: السائق وأوقات الإسناد والاستلام والتسليم، وسبب تعذّر التسليم إن وُجد، ورابط الخرائط. */
function DeliveryDetails({ record }: { record: Named }) {
  const { t } = useTranslation();
  const driver = asRecord(record.driver);
  const driverName = toText(driver.name);
  const driverPhone = toText(driver.phone);
  const failureReason = toText(record.delivery_failed_reason);
  const failureNote = toText(record.delivery_failed_note);
  const mapUrl = toText(record.maps_url);

  return (
    <>
      <Info
        label={t("drivers.details.driver")}
        value={driverName ? `${driverName}${driverPhone ? ` · ${driverPhone}` : ""}` : t("drivers.assign.none")}
      />
      <Info label={t("drivers.details.assignedAt")} value={formatDateTime(toText(record.assigned_at) || null)} />
      <Info label={t("drivers.details.pickedUpAt")} value={formatDateTime(toText(record.picked_up_at) || null)} />
      <Info label={t("drivers.details.deliveredAt")} value={formatDateTime(toText(record.delivered_at) || null)} />
      {failureReason && (
        <Info
          label={t("drivers.details.failure")}
          value={t(`deliveryFailure.reasons.${failureReason}`, { defaultValue: failureReason })}
        />
      )}
      {failureReason && (
        <Info label={t("drivers.details.failedAt")} value={formatDateTime(toText(record.delivery_failed_at) || null)} />
      )}
      {failureNote && <Info label={t("drivers.details.failureNote")} value={failureNote} wide />}
      {mapUrl && (
        <Info
          label={t("drivers.details.location")}
          value={
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
              {t("drivers.card.openMap")}
            </a>
          }
          wide
        />
      )}
    </>
  );
}

function Info({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : undefined}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-ink-soft">
      <span>{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}
