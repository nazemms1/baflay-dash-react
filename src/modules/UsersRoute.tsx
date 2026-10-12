import { useCallback } from "react";
import type { TFunction } from "i18next";
import { useBranchScope } from "@/features/auth/hooks";
import { ModuleRoute } from "./ModuleRoute";
import { usersModule } from "./people";

/**
 * شاشة المستخدمين تُبنى بحسب نطاق الحساب: مدير الفرع لا يرسل الفرع، فتتغيّر الوحدة
 * حين يتغيّر النطاق، ويُعاد بناؤها بلغة الواجهة كما تفعل كل وحدة.
 */
export function UsersRoute() {
  const scoped = useBranchScope().isBranchScoped;
  const build = useCallback((t: TFunction) => usersModule(t, scoped), [scoped]);
  return <ModuleRoute build={build} />;
}
