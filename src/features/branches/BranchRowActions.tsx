import type { Named } from "@/services";
import { CategoryOrderAction } from "./CategoryOrderAction";
import { DeliveryToggleAction } from "./DeliveryToggleAction";

/** أزرار صف الفرع: ترتيب التصنيفات، ثم تشغيل التوصيل أو إيقافه. */
export function BranchRowActions({ row }: { row: Named }) {
  return (
    <>
      <CategoryOrderAction row={row} />
      <DeliveryToggleAction row={row} />
    </>
  );
}
