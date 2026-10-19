import type { Named } from "@/services";
import { CategoryOrderAction } from "./CategoryOrderAction";
import { OpeningHoursAction } from "./OpeningHoursAction";
import { OrderTypeToggle } from "./OrderTypeToggle";

/** أزرار صف الفرع: ترتيب التصنيفات، ثم التوصيل والاستلام، ثم أوقات الدوام. */
export function BranchRowActions({ row }: { row: Named }) {
  return (
    <>
      <CategoryOrderAction row={row} />
      <OrderTypeToggle row={row} type="delivery" />
      <OrderTypeToggle row={row} type="pickup" />
      <OpeningHoursAction row={row} />
    </>
  );
}
