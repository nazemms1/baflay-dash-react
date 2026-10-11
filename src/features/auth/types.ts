import type { Bilingual } from "@/lib/localized";

/** قاعدة صلاحية كما يرسلها الخادم داخل `abilityRules` من `users/profile`. */
export interface AbilityRule {
  /** اسم المسار الذي تحرسه الصلاحية: `admin.orders.status.update`. */
  name?: string;
  action?: string;
  subject?: string;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  /** الحساب الذي يملك صلاحية واحدة على الأقل خارج مجموعة الزبون. */
  isStaff: boolean;
  /** `null` يعني حساباً غير مربوط بفرع، فيرى السلسلة كاملة. */
  branchId: number | null;
  branch: Bilingual | null;
  abilityRules: AbilityRule[];
  /** أسماء الأدوار المسندة للحساب، للعرض فقط. */
  roles: string[];
}
