import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextArea } from "@/components/ui/Fields";
import { currentLanguage } from "@/i18n";
import { toNumber, toText } from "@/lib/coerce";
import { toApiError } from "@/lib/http/errors";
import { orderAdmin, type Named } from "@/services";
import { StatusBadge } from "./StatusBadge";
import { statusDotClass } from "./statusTone";
import { isFinalOrder, nextStatusesOf, serverLabelOf, stagesOf } from "./orderStatus";

type EndStatus = "cancelled" | "rejected";

const isEnding = (code: string): code is EndStatus => code === "cancelled" || code === "rejected";

/**
 * نافذة تغيير الحالة: تعرض مراحل الطلب بتسمياتها الرسمية، ثم الخطوة التالية كأزرار واضحة
 * تُطبَّق بنقرة. الإلغاء والرفض في قسم منفصل، ولا يُنفَّذان إلا بعد تأكيد (والرفض يطلب سبباً).
 */
export function StatusPicker({ row, onClose }: { row: Named; onClose: () => void }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClient = useQueryClient();
  const [ending, setEnding] = useState<EndStatus | null>(null);
  const [reason, setReason] = useState("");

  const id = toNumber(row.id);
  const current = toText(row.status);
  const final = isFinalOrder(row);
  const endedBadly = current === "cancelled" || current === "rejected";
  const next = nextStatusesOf(row);
  const flowNext = next.filter((code) => !isEnding(code));
  const endings = next.filter(isEnding);
  const stages = stagesOf(row, language);

  const labelOf = (code: string) => serverLabelOf(row, code, language) ?? t(`orders.status.${code}`, { defaultValue: code });

  const change = useMutation({
    mutationFn: ({ status, why }: { status: string; why?: string }) =>
      orderAdmin.setStatus(id, { status, ...(why ? { reason: why } : {}) }),
    onSuccess: async () => {
      toast.success(t("orders.statusUpdated"));
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={toText(row.order_number) || `#${id}`}
      description={t("ordersPage.changeHint")}
    >
      <div className="space-y-6">
        <section className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
          <span className="text-sm text-muted">{t("ordersPage.currentStatus")}</span>
          <StatusBadge status={current} label={serverLabelOf(row, current, language)} />
        </section>

        {!endedBadly && stages.length > 0 && (
          <ol className="flex items-start gap-2">
            {stages.map((stage, index) => (
              <li key={stage.code} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                <span
                  className={`grid size-8 place-items-center rounded-full text-xs font-bold ${
                    stage.state === "done"
                      ? "bg-ok text-white"
                      : stage.state === "current"
                        ? "bg-primary text-ink ring-4 ring-primary/30"
                        : "bg-canvas text-muted ring-1 ring-line"
                  }`}
                >
                  {stage.state === "done" ? <Check className="size-4" aria-hidden /> : index + 1}
                </span>
                <span className={`text-xs leading-tight ${stage.state === "upcoming" ? "text-muted" : "font-medium text-ink"}`}>
                  {stage.label ?? t(`orders.status.${stage.code}`, { defaultValue: stage.code })}
                </span>
              </li>
            ))}
          </ol>
        )}

        {final ? (
          <p className="flex items-center gap-2 rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft">
            <Lock className="size-4 shrink-0" aria-hidden />
            {t("ordersPage.finalLocked")}
          </p>
        ) : (
          <>
            {flowNext.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">{t("ordersPage.nextSteps")}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {flowNext.map((code) => (
                    <button
                      key={code}
                      type="button"
                      disabled={change.isPending}
                      onClick={() => change.mutate({ status: code })}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-start text-sm font-medium transition hover:border-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className={`size-2.5 shrink-0 rounded-full ${statusDotClass(code)}`} aria-hidden />
                      <span className="flex-1">{labelOf(code)}</span>
                      {change.isPending && change.variables?.status === code && (
                        <span className="text-xs text-muted">{t("crud.saving")}</span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {endings.length > 0 && (
              <section className="space-y-3 border-t border-line pt-5">
                <h3 className="text-sm font-semibold text-ink">{t("ordersPage.endOrder")}</h3>
                <div className="flex flex-wrap gap-2">
                  {endings.map((code) => (
                    <Button
                      key={code}
                      variant={ending === code ? "danger" : "ghost"}
                      disabled={change.isPending}
                      onClick={() => {
                        setEnding(code);
                        setReason("");
                      }}
                    >
                      {code === "rejected" ? t("ordersPage.endReject") : t("ordersPage.endCancel")}
                    </Button>
                  ))}
                </div>

                {ending && (
                  <div className="space-y-3 rounded-xl bg-danger-soft p-4">
                    {ending === "rejected" && (
                      <TextArea
                        label={t("ordersPage.rejectReason")}
                        rows={3}
                        maxLength={255}
                        required
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" disabled={change.isPending} onClick={() => setEnding(null)}>
                        {t("ordersPage.undo")}
                      </Button>
                      <Button
                        variant="danger"
                        disabled={change.isPending || (ending === "rejected" && reason.trim().length < 3)}
                        onClick={() => change.mutate({ status: ending, why: reason.trim() || undefined })}
                      >
                        {change.isPending ? t("crud.saving") : t(ending === "rejected" ? "ordersPage.rejectOk" : "ordersPage.cancelOk")}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
