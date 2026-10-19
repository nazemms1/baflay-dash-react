import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { toApiError } from "@/lib/http/errors";
import { branchApi, type Named } from "@/services";

export type OrderType = "delivery" | "pickup";

interface OrderTypeConfig {
  /** الحقل الذي يحمل حالة النوع في الفرع، كما يعيده الخادم. */
  field: string;
  /** النوع الآخر، ويُقرأ لمنع إطفاء آخر نوع مفتوح. */
  other: string;
  /** اسم الصلاحية بالاسم الذي يعرفه الخادم. */
  permission: string;
  icon: LucideIcon;
  labelKey: string;
  onKey: string;
  offKey: string;
  savedKey: string;
  save: (branchId: number, on: boolean) => Promise<unknown>;
}

const ORDER_TYPES: Record<OrderType, OrderTypeConfig> = {
  delivery: {
    field: "is_accepting_delivery",
    other: "is_accepting_pickup",
    permission: "branches.delivery.availability.update",
    icon: Truck,
    labelKey: "crud.field.isAcceptingDelivery",
    onKey: "crud.deliveryOn",
    offKey: "crud.deliveryOff",
    savedKey: "deliveryToggle.saved",
    save: branchApi.setDeliveryAvailability,
  },
  pickup: {
    field: "is_accepting_pickup",
    other: "is_accepting_delivery",
    permission: "branches.pickup.availability.update",
    icon: ShoppingBag,
    labelKey: "orderTypes.pickupField",
    onKey: "orderTypes.pickupOn",
    offKey: "orderTypes.pickupOff",
    savedKey: "orderTypes.pickupSaved",
    save: branchApi.setPickupAvailability,
  },
};

/** الخادم يرفض إطفاء آخر نوع طلب مفتوح بالرمز `last_order_type`، فيُعرض نص واضح بدل رسالته الخام. */
function messageOf(caught: unknown, t: TFunction): string {
  const apiError = toApiError(caught, t("errors.unexpected"));
  return apiError.code === "last_order_type" ? t("orderTypes.lastType") : apiError.message;
}

/**
 * زر تشغيل نوع طلب في صف الفرع: التوصيل أو الاستلام من الفرع. الإيقاف لا يمسّ مسافة التوصيل
 * ولا رسومه، ولا يلغي الطلبات الجارية.
 */
export function OrderTypeToggle({ row, type }: { row: Named; type: OrderType }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const config = ORDER_TYPES[type];
  const canToggle = usePermissions().has(config.permission);
  const accepting = Boolean(row[config.field]);
  // آخر نوع مفتوح لا يُطفأ: الزر معطّل مع سببه، والخادم يرفضه أيضاً إن وصل الطلب.
  const isLastOpen = accepting && !row[config.other];

  const save = useMutation({
    mutationFn: (next: boolean) => config.save(row.id, next),
    onSuccess: async () => {
      toast.success(t(config.savedKey));
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (caught) => toast.error(messageOf(caught, t)),
  });

  if (!canToggle) return null;

  const Icon = config.icon;
  const label = t(config.labelKey);
  const state = accepting ? t(config.onKey) : t(config.offKey);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={accepting}
      aria-label={label}
      title={isLastOpen ? t("orderTypes.keepOne") : `${label}: ${state}`}
      disabled={save.isPending || isLastOpen}
      onClick={() => save.mutate(!accepting)}
      className={`grid size-8 cursor-pointer place-items-center rounded-lg transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 ${accepting ? "text-ok" : "text-muted"}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
