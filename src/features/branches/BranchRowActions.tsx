import type { Named } from "@/services";
import { CategoryImagesAction } from "./CategoryImagesAction";
import { CategoryOrderAction } from "./CategoryOrderAction";
import { OpeningHoursAction } from "./OpeningHoursAction";
import { OrderTypeToggle } from "./OrderTypeToggle";
import { PaymentMethodToggle } from "./PaymentMethodToggle";

/** أزرار صف الفرع: ترتيب التصنيفات وصورها، ثم التوصيل والاستلام، ثم النقد والبطاقة، ثم أوقات الدوام. */
export function BranchRowActions({ row }: { row: Named }) {
  return (
    <>
      <CategoryOrderAction row={row} />
      <CategoryImagesAction row={row} />
      <OrderTypeToggle row={row} type="delivery" />
      <OrderTypeToggle row={row} type="pickup" />
      <PaymentMethodToggle row={row} method="cash" />
      <PaymentMethodToggle row={row} method="card" />
      <OpeningHoursAction row={row} />
    </>
  );
}
