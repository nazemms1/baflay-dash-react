/** مقطع الصلاحيات لشاشة السائق. يُقرأ بـ `hasPrefix` فيظهر الزر لمن يملك أياً من الست. */
export const DRIVER_SCREEN_PREFIX = "driver.orders";

/** صلاحيات دور `driver` الست، كما يرسلها الخادم. */
export const DRIVER_PERMISSIONS = {
  index: "driver.orders.index",
  show: "driver.orders.show",
  summary: "driver.orders.summary",
  pickup: "driver.orders.pickup",
  delivered: "driver.orders.delivered",
  failed: "driver.orders.failed",
} as const;

/** صلاحيات الإدارة لإسناد السائقين وحساب السائقين. */
export const ADMIN_DRIVER_PERMISSIONS = {
  assign: "admin.orders.driver.assign",
  report: "admin.orders.driver-report",
} as const;

/** اسم الدور في الخادم، ويُستعمل فلتراً لقائمة المستخدمين. */
export const DRIVER_ROLE = "driver";
