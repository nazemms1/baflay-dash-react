import { useCallback } from "react";
import type { TFunction } from "i18next";
import { useBranchScope } from "@/features/auth/hooks";
import { ModuleRoute } from "./ModuleRoute";
import { usersModule } from "./people";

/**
 * شاشة المستخدمين تُبنى بحسب نطاق الحساب: مدير الفرع لا يرسل الفرع، فتتغيّر الوحدة
 * حين يتغيّر النطاق، ويُعاد بناؤها بلغة الواجهة كما تفعل كل وحدة. `staff` يحدد الشاشة
 * الفرعية: الموظفون أو غيرهم، وبدونه تظهر كل الحسابات.
 */
export function UsersRoute({ staff }: { staff?: boolean }) {
  const scoped = useBranchScope().isBranchScoped;
  const build = useCallback((t: TFunction) => usersModule(t, scoped, staff), [scoped, staff]);
  return <ModuleRoute build={build} />;
}
