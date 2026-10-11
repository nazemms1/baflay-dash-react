/**
 * نقطة الدخول الوحيدة لطبقة الخدمات. الشاشات تستورد من هنا، لا من الملفات
 * الفرعية، فإعادة ترتيب الملفات لاحقاً لا تكسر أحداً.
 */
export * from "./resource";
export * from "./geography";
export * from "./catalog";
export * from "./orders";
export * from "./people";
export * from "./surveys-answers";
