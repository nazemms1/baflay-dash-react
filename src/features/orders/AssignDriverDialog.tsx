import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SelectField } from "@/components/ui/Fields";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { driverErrorCode, driverErrorMessage, STALE_ORDER_CODES } from "@/features/drivers/driverErrors";
import { driversOfBranch, useDriverOptions } from "@/features/drivers/useDriverOptions";
import { asRecord, toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { orderAdmin, type Named } from "@/services";

/** نافذة إسناد سائق لطلب توصيل، أو سحبه منه. تعرض سائقي فرع الطلب فقط. */
export function AssignDriverDialog({ row, onClose }: { row: Named; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const drivers = useDriverOptions(true);
  const branchId = toNullableNumber(row.branch_id ?? asRecord(row.branch).id);
  const currentId = toNullableNumber(row.driver_id ?? asRecord(row.driver).id);
  const [choice, setChoice] = useState<number | null>(currentId);

  const options = driversOfBranch(drivers.data ?? [], branchId).map((driver) => ({
    value: driver.id,
    label: driver.name,
  }));

  const save = useMutation({
    mutationFn: (driverId: number | null) => orderAdmin.assignDriver(toNumber(row.id), driverId),
    onSuccess: async (_result, driverId) => {
      toast.success(t(driverId === null ? "drivers.assign.removed" : "drivers.assign.done"));
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
    onError: async (error) => {
      toast.error(driverErrorMessage(error, t, t("errors.unexpected")));
      if (STALE_ORDER_CODES.includes(driverErrorCode(error) ?? "")) {
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    },
  });

  const reference = toText(row.order_number) || `#${toNumber(row.id)}`;

  return (
    <Dialog open onClose={onClose} size="md" title={reference} description={t("drivers.assign.hint")}>
      {drivers.isPending ? (
        <Skeleton className="h-28" />
      ) : drivers.isError ? (
        <ErrorState message={t("errors.unexpected")} onRetry={() => void drivers.refetch()} />
      ) : options.length === 0 ? (
        <EmptyState>{t("drivers.assign.noDrivers")}</EmptyState>
      ) : (
        <div className="space-y-5">
          <SelectField
            label={t("drivers.assign.label")}
            options={options}
            placeholder={t("drivers.assign.pick")}
            value={choice}
            onChange={(value) => setChoice(value === null ? null : Number(value))}
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
      )}
    </Dialog>
  );
}
