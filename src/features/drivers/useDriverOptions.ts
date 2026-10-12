import { useQuery } from "@tanstack/react-query";
import { toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { listAll, users } from "@/services";
import { DRIVER_ROLE } from "./permissions";

export interface DriverOption {
  id: number;
  name: string;
  branchId: number | null;
}

/** كل السائقين الذين يراهم الحساب. الخادم يحصر مدير الفرع بفرعه، والإدارة ترى الجميع. */
export function useDriverOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["drivers", "options"],
    enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const rows = await listAll(
        (query, pageSignal) => users.list({ ...query, role: DRIVER_ROLE }, pageSignal),
        signal
      );
      return rows.map(
        (row): DriverOption => ({
          id: toNumber(row.id),
          name: toText(row.name) || `#${toText(row.id)}`,
          branchId: toNullableNumber(row.branch_id),
        })
      );
    },
  });
}

/** سائقو فرع الطلب فقط. سائق بلا فرع معروف يبقى ظاهراً، والخادم يرفض غير المناسب برمز واضح. */
export const driversOfBranch = (drivers: DriverOption[], branchId: number | null): DriverOption[] =>
  drivers.filter((driver) => branchId === null || driver.branchId === null || driver.branchId === branchId);
