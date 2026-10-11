import { useMemo } from "react";
import { branchScopeOf, createPermissions, type Permissions } from "./permissions";
import { useSession } from "./session-store";

/** صلاحيات المستخدم الحالي، تُحسب مرة واحدة لكل تغيّر في القواعد. */
export function usePermissions(): Permissions {
  const rules = useSession((state) => state.user?.abilityRules);
  return useMemo(() => createPermissions(rules ?? []), [rules]);
}

export function useBranchScope() {
  const user = useSession((state) => state.user);
  const permissions = usePermissions();
  return useMemo(() => branchScopeOf(user, permissions), [user, permissions]);
}
