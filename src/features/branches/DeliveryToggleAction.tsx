import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { toApiError } from "@/lib/http/errors";
import { branchApi, type Named } from "@/services";

/** صلاحية تشغيل التوصيل في الفرع أو إيقافه، بالاسم الذي يعرفه الخادم. */
const DELIVERY_PERMISSION = "branches.delivery-availability.update";

/**
 * زر التوصيل في صف الفرع: يشغّل التوصيل أو يوقفه، والاستلام يبقى مفتوحاً في الحالتين.
 * الإيقاف لا يمسّ مسافة التوصيل ولا رسومه.
 */
export function DeliveryToggleAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canToggle = usePermissions().has(DELIVERY_PERMISSION);
  const accepting = Boolean(row.is_accepting_delivery);

  const save = useMutation({
    mutationFn: (next: boolean) => branchApi.setDeliveryAvailability(row.id, next),
    onSuccess: async () => {
      toast.success(t("deliveryToggle.saved"));
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  if (!canToggle) return null;

  const state = accepting ? t("crud.deliveryOn") : t("crud.deliveryOff");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={accepting}
      aria-label={t("crud.field.isAcceptingDelivery")}
      title={`${t("crud.field.isAcceptingDelivery")}: ${state}`}
      disabled={save.isPending}
      onClick={() => save.mutate(!accepting)}
      className={`grid size-8 cursor-pointer place-items-center rounded-lg transition hover:bg-primary-soft disabled:opacity-50 ${accepting ? "text-ok" : "text-muted"}`}
    >
      <Truck className="size-4" aria-hidden />
    </button>
  );
}
