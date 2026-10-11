import clsx from "clsx";

/**
 * شكل القوائم المنسدلة الموحّد في كل الشاشات، وهو شكل فلتر الفرع في لوحة التحكم.
 * كل قائمة منسدلة في التطبيق تستعمل هذا الشكل: القائمة الأصلية، وزر القائمة القابلة للبحث،
 * وحقول النماذج، فلا يختلف شكل حقل عن آخر.
 */
export function dropdownClass({ error, open }: { error?: boolean; open?: boolean } = {}): string {
  return clsx(
    "h-9 rounded-xl border bg-canvas px-3 text-sm text-ink outline-none transition",
    "focus:border-primary disabled:cursor-not-allowed disabled:opacity-60",
    error ? "border-danger" : "border-line",
    open && "border-primary"
  );
}
