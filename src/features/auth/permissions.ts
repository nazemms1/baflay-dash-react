import type { AbilityRule, SessionUser } from "./types";

/**
 * الصلاحيات أسماء مسارات يولّدها الخادم (`admin.orders.status.update`)،
 * فالتحقق يكون بالاسم نفسه، لا بمقارنة الحقول المتفرقة.
 */
export interface Permissions {
  /** `manage all`: وصول على مستوى السلسلة كلها. */
  readonly isManageAll: boolean;
  /** هل يملك الحساب هذه الصلاحية بالاسم الكامل؟ */
  has(name: string): boolean;
  /**
   * هل يملك الحساب أي صلاحية تبدأ بهذه البادئة؟ للشاشة التي تقرأ عدّة مسارات
   * ولا يهمّها أيّها بالضبط، مثل لوحة التحكم.
   */
  hasPrefix(prefix: string): boolean;
}

const nameOf = (rule: AbilityRule): string | null => {
  if (rule.name) return rule.name;
  if (rule.subject && rule.action) return `${rule.subject}.${rule.action}`;
  return null;
};

export function createPermissions(rules: AbilityRule[]): Permissions {
  const isManageAll = rules.some(
    (rule) => rule.action === "manage" && rule.subject === "all"
  );
  const names = new Set(rules.map(nameOf).filter((name): name is string => !!name));

  return {
    isManageAll,
    has: (name) => isManageAll || names.has(name),
    hasPrefix: (prefix) =>
      isManageAll || [...names].some((name) => name.startsWith(prefix)),
  };
}

export interface BranchScope {
  /** الحساب مربوط بفرع فيرى بياناته وحدها؛ القرار هنا يحدد ما تعرضه الشاشات. */
  isBranchScoped: boolean;
  branchId: number | null;
}

/**
 * `manage all` يتجاوز ربط الفرع: الخادم لا يحصر هذا الدور بفرع حتى لو كان
 * `branch_id` مضبوطاً، فالواجهة تتبع القاعدة نفسها.
 */
export function branchScopeOf(user: SessionUser | null, permissions: Permissions): BranchScope {
  const branchId = user?.branchId ?? null;
  return {
    isBranchScoped: branchId !== null && !permissions.isManageAll,
    branchId,
  };
}
