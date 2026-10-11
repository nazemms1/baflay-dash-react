import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";

/** الصلاحية التي تفتح كل صفحة يقود إليها رابط سريع، بالمسار دون الاستعلام. */
const PERMISSION_BY_PATH: Record<string, string> = {
  "/orders": "admin.orders.index",
  "/branches": "branches.index",
  "/items": "items.index",
};

/**
 * رابط سريع في رأس لوحة التحكم، يفتح الشاشة المعنية بالبيانات المعروضة (فروع، طلبات، أصناف).
 * لا يظهر إلا لمن يملك صلاحية تلك الشاشة، ومسار غير معروف صلاحيته لا يظهر أصلاً.
 */
export function QuickLink({ to, label }: { to: string; label: string }) {
  const permissions = usePermissions();
  const required = PERMISSION_BY_PATH[to.split("?")[0]];
  if (!required || !permissions.has(required)) return null;

  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-sm font-medium text-secondary transition hover:bg-secondary-soft"
    >
      {label}
      <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
