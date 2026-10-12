import { Navigate } from "react-router-dom";
import { usePermissions } from "@/features/auth/hooks";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { DRIVER_SCREEN_PREFIX } from "@/features/drivers/permissions";

/**
 * الجذر هو لوحة التحكم لمن يملك صلاحيتها. السائق، وهو حساب بصلاحيات الطلبات فقط، يُحوَّل
 * إلى شاشته. ومن لا يملك أياً منهما يُستقبل بصفحة الترحيب كما في الداشبورد القديم.
 */
export function HomeRoute() {
  const permissions = usePermissions();
  if (permissions.hasPrefix("admin.dashboard")) return <DashboardPage />;
  if (permissions.hasPrefix(DRIVER_SCREEN_PREFIX)) return <Navigate to="/driver-orders" replace />;
  return <Navigate to="/welcome" replace />;
}
