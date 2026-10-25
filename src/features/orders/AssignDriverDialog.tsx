import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { RemoteSelect } from "@/components/ui/RemoteSelect";
import { driverErrorCode, driverErrorMessage, STALE_ORDER_CODES } from "@/features/drivers/driverErrors";
import { driverSource } from "@/features/drivers/driverSource";
import { asRecord, toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { orderAdmin, type Named } from "@/services";

/** نافذة إسناد سائق لطلب توصيل، أو سحبه منه. تبحث بين سائقي فرع الطلب على الخادم فقط. */
export function AssignDriverDialog({ row, onClose }: { row: Named; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const branchId = toNullableNumber(row.branch_id ?? asRecord(row.branch).id);
  const currentId = toNullableNumber(row.driver_id ?? asRecord(row.driver).id);
  const [choice, setChoice] = useState<number | null>(currentId);
  // الاسم يُعرض من الطلب نفسه، فلا يُطلب السائق من الخادم إلا إذا اختير غيره.
  const [choiceLabel, setChoiceLabel] = useState(toText(asRecord(row.driver).name));
  const source = useMemo(() => driverSource(branchId), [branchId]);

  const save = useMutation({
    mutationFn: (driverId: number | null) => orderAdmin.assignDriver(toNumber(row.id), driverId),
    onSuccess: async (_result, driverId) => {
      toast.success(t(driverId === null ? "drivers.assign.removed" : "drivers.assign.done"));
      await queryClient.invalidateQueries({ queryKey: ["orders", "admin"] });
      onClose();
    },
    onError: async (error) => {
      toast.error(driverErrorMessage(error, t, t("errors.unexpected")));
      if (STALE_ORDER_CODES.includes(driverErrorCode(error) ?? "")) {
        await queryClient.invalidateQueries({ queryKey: ["orders", "admin"] });
      }
    },
  });

  const reference = toText(row.order_number) || `#${toNumber(row.id)}`;

  return (
    <Dialog open onClose={onClose} size="md" title={reference} description={t("drivers.assign.hint")}>
      <div className="space-y-5">
        <RemoteSelect
          label={t("drivers.assign.label")}
          source={source}
          value={choice}
          fallbackLabel={choiceLabel || undefined}
          placeholder={t("drivers.assign.pick")}
          required
          onChange={(value, label) => {
            setChoice(value === null ? null : Number(value));
            setChoiceLabel(label);
          }}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {currentId !== null && (
            <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate(null)}>
              {t("drivers.assign.unassign")}
            </Button>
          )}
          <Button
            disabled={save.isPending || choice === null || choice === currentId}
            onClick={() => {
              if (choice !== null) save.mutate(choice);
            }}
          >
            {save.isPending ? t("crud.saving") : t("drivers.assign.submit")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
