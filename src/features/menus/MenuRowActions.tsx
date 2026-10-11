import { DuplicateMenuAction } from "./DuplicateMenuAction";
import { MenuSettingsAction } from "./MenuSettingsAction";
import type { Named } from "@/services";

/** أزرار صف القائمة كلها: نسخها إلى فرع آخر، وإعداداتها (الكومبو والإضافات والاقتراحات). */
export function MenuRowActions({ row }: { row: Named }) {
  return (
    <>
      <DuplicateMenuAction row={row} />
      <MenuSettingsAction row={row} />
    </>
  );
}
