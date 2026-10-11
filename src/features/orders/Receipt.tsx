import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Clock, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { usePermissions } from "@/features/auth/hooks";
import { currentLanguage } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { toApiError } from "@/lib/http/errors";
import { orderAdmin } from "@/services";

export interface ReceiptLine {
  name: string;
  /** النوع والكومبو والإضافات والصلصات تحت اسم الصنف. */
  detail: string;
  quantity: number;
  /** سعر الوحدة، ليظهر تحت السطر حين تزيد الكمية على واحد. */
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  /** معرّف الطلب في الخادم، لتسليمه بنقرة واحدة من الإيصال. */
  orderId: number;
  /** حالة الطلب بعد إنشائه: `submitted` تعني قيد الانتظار، و`completed` تعني تم. */
  status: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  orderNumber: string;
  time: Date;
  cashierName: string;
  customerName: string;
  customerPhone: string;
  lines: ReceiptLine[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

const DONE_STATUS = "completed";

/**
 * إيصال الدفع النقدي للكاشير: هوية المطعم ورقم الطلب وحالته في الرأس، ثم الفرع والكاشير
 * والزبون والتاريخ، ثم الأصناف بإضافاتها وكمياتها وأسعار وحداتها، ثم الحساب والإجمالي بارزاً.
 * زر «تسليم الطلب» يكمل الطلب بنقرة واحدة، والطباعة تُخرج الإيصال وحده بعرض 80mm.
 */
export function Receipt({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = currentLanguage();
  const [status, setStatus] = useState(data.status);
  // التسليم تغيير حالة، فيحتاج صلاحية تغيير الحالة كأي تغيير آخر.
  const canFinish = usePermissions().has("admin.orders.status.update") && data.orderId > 0;
  const done = status === DONE_STATUS;

  const money = (amount: number) => formatMoney(amount, data.currency);
  const when = data.time.toLocaleString(language === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const customer = [data.customerName, data.customerPhone].filter(Boolean).join(" · ") || "—";

  const finish = useMutation({
    mutationFn: () => orderAdmin.setStatus(data.orderId, { status: DONE_STATUS }),
    onSuccess: async () => {
      setStatus(DONE_STATUS);
      toast.success(t("receipt.doneSaved"));
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={t("createOrder.receiptTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("createOrder.closeReceipt")}</Button>
          {canFinish && !done && (
            <Button onClick={() => finish.mutate()} disabled={finish.isPending} className="bg-ok text-white hover:bg-ok/90">
              <Check className="size-4" aria-hidden />
              {finish.isPending ? t("crud.saving") : t("receipt.markDone")}
            </Button>
          )}
          <Button onClick={() => window.print()} className="bg-primary text-ink hover:bg-primary/90">
            <Printer className="size-4" aria-hidden />
            {t("createOrder.print")}
          </Button>
        </>
      }
    >
      <article
        id="print-area"
        className="receipt-print mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface text-ink shadow-sm"
      >
        <header className="bg-primary px-6 pb-8 pt-7 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">{t("receipt.kicker")}</p>
          <p className="mt-1 text-2xl font-extrabold">{t("app.name")}</p>
          <p className="mt-3 text-sm font-semibold">{data.branchName}</p>
          {data.branchAddress && <p className="mt-0.5 text-xs text-ink-soft">{data.branchAddress}</p>}
          {data.branchPhone && (
            <p dir="ltr" className="text-xs tabular-nums text-ink-soft">
              {data.branchPhone}
            </p>
          )}
        </header>

        <div className="mx-6 -mt-5 rounded-2xl bg-surface px-4 py-3 text-center shadow ring-1 ring-line">
          <p className="text-[11px] text-muted">{t("receipt.orderNo")}</p>
          <p className="font-mono text-xl font-bold tabular-nums">{data.orderNumber}</p>
        </div>
        <div className="mt-3 flex justify-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              done ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
            }`}
          >
            {done ? <Check className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
            {done ? t("receipt.statusDone") : t("receipt.statusPending")}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 pt-5 text-xs">
          <Meta label={t("receipt.dateTime")} value={when} />
          <Meta label={t("receipt.cashier")} value={data.cashierName || "—"} />
          <Meta label={t("receipt.payment")} value={t("orderInvoice.cash")} />
          <Meta label={t("receipt.customer")} value={customer} />
        </dl>

        <section className="px-6 pt-5">
          <div className="flex items-center justify-between border-b border-line pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span>{t("createOrder.itemColumn")}</span>
            <span>{t("createOrder.priceColumn")}</span>
          </div>
          <ul className="divide-y divide-dashed divide-line">
            {data.lines.map((line, index) => (
              <li key={index} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-primary-soft px-1.5 text-xs font-bold tabular-nums">
                  ×{line.quantity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{line.name}</p>
                  {line.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted">{line.detail}</p>}
                  {line.quantity > 1 && (
                    <p className="mt-0.5 text-xs tabular-nums text-muted">
                      {t("receipt.eachAt", { price: money(line.unitPrice) })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{money(line.total)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-6 space-y-2 border-t border-dashed border-line py-4 text-sm">
          <Row label={t("createOrder.subtotal")} value={money(data.subtotal)} />
          <Row label={t("createOrder.tax")} value={money(data.tax)} />
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-primary px-4 py-3">
            <span className="font-bold">{t("createOrder.total")}</span>
            <span className="text-xl font-extrabold tabular-nums">{money(data.total)}</span>
          </div>
        </section>

        <footer className="space-y-3 px-6 pb-7 text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-3 py-1 text-xs font-semibold text-ok">
            <Check className="size-3.5" aria-hidden />
            {t("createOrder.paidCash")}
          </p>
          <p className="text-sm font-semibold">{t("receipt.thankYou")}</p>
          <p className="text-xs text-muted">{t("receipt.visitAgain")}</p>
        </footer>
      </article>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-ink-soft">
      <span>{label}</span>
      <span className="font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}
