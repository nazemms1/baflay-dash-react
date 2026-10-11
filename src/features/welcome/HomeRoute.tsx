import { Navigate } from "react-router-dom";
import { usePermissions } from "@/features/auth/hooks";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

/**
 * الجذر هو لوحة التحكم لمن يملك صلاحيتها، ومن لا يملكها يُستقبل بصفحة الترحيب كما في
 * الداشبورد القديم، فلا يبقى على شاشة فارغة ولا يُرفض بتحذير.
 */
export function HomeRoute() {
  const permissions = usePermissions();
  if (!permissions.hasPrefix("admin.dashboard")) return <Navigate to="/welcome" replace />;
  return <DashboardPage />;
}
