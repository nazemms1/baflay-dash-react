import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { Banknote, CreditCard, type LucideIcon } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { toApiError } from "@/lib/http/errors";
import { branchApi, type Named } from "@/services";

export type PaymentMethod = "cash" | "card";

interface PaymentMethodConfig {
  /** الحقل الذي يحمل حالة الطريقة في الفرع، كما يعيده الخادم. */
  field: string;
  /** الطريقة الأخرى، وتُقرأ لمنع إطفاء آخر طريقة مفعّلة. */
  other: string;
  /** حقل يعطّل الطريقة كلها إن كان `false`: بطاقة الفرع تحتاج حساباً إلكترونياً. */
  requires?: string;
  icon: LucideIcon;
  labelKey: string;
  unavailableKey?: string;
  save: (branchId: number, on: boolean) => Promise<unknown>;
}

const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodConfig> = {
  cash: {
    field: "accepts_cash",
    other: "accepts_card",
    icon: Banknote,
    labelKey: "paymentMethods.cash",
    save: (branchId, on) => branchApi.setPaymentMethods(branchId, { accepts_cash: on }),
  },
  card: {
    field: "accepts_card",
    other: "accepts_cash",
    requires: "can_take_card",
    icon: CreditCard,
    labelKey: "paymentMethods.card",
    unavailableKey: "paymentMethods.noCardAccount",
    save: (branchId, on) => branchApi.setPaymentMethods(branchId, { accepts_card: on }),
  },
};

/** صلاحية تعديل طرق الدفع، بالاسم الذي يعرفه الخادم. */
const PAYMENT_METHODS_PERMISSION = "branches.payment.methods.update";

/** الخادم يرفض إطفاء آخر طريقة دفع مفعّلة بالرمز `last_payment_method`، فيُعرض نص واضح بدل رسالته الخام. */
function messageOf(caught: unknown, t: TFunction): string {
  const apiError = toApiError(caught, t("errors.unexpected"));
  return apiError.code === "last_payment_method" ? t("paymentMethods.lastMethod") : apiError.message;
}

/**
 * زر قبول طريقة دفع في صف الفرع: النقد أو البطاقة. البطاقة معطّلة للفرع الذي لا حساب إلكترونياً له،
 * وآخر طريقة مفعّلة لا تُطفأ.
 */
export function PaymentMethodToggle({ row, method }: { row: Named; method: PaymentMethod }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const config = PAYMENT_METHODS[method];
  const canToggle = usePermissions().has(PAYMENT_METHODS_PERMISSION);
  const accepting = Boolean(row[config.field]);
  const unavailable = config.requires !== undefined && row[config.requires] === false;
  const isLastOpen = accepting && !row[config.other];

  const save = useMutation({
    mutationFn: (next: boolean) => config.save(row.id, next),
    onSuccess: async () => {
      toast.success(t("paymentMethods.saved"));
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (caught) => toast.error(messageOf(caught, t)),
  });

  if (!canToggle) return null;

  const Icon = config.icon;
  const label = t(config.labelKey);
  const state = accepting ? t("paymentMethods.accepted") : t("paymentMethods.notAccepted");
  const title = unavailable && config.unavailableKey
    ? t(config.unavailableKey)
    : isLastOpen
      ? t("paymentMethods.keepOne")
      : `${label}: ${state}`;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={accepting}
      aria-label={label}
      title={title}
      disabled={save.isPending || unavailable || isLastOpen}
      onClick={() => save.mutate(!accepting)}
      className={`grid size-8 cursor-pointer place-items-center rounded-lg transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 ${accepting ? "text-ok" : "text-muted"}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
