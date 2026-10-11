import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppSplash } from "@/components/ui/States";
import { useSession } from "./session-store";

/** الصفحات التي يصلها أي حساب مسجّل، حتى بلا صلاحية لوحة: الترحيب والملف الشخصي. */
const OPEN_TO_ANY_ACCOUNT = ["/welcome", "/profile"];

/**
 * حارس المسارات الداخلية. ثلاث حالات: ننتظر التحقق، أو لا جلسة فنذهب للدخول،
 * أو جلسة لحساب غير موظف فلا يصل إلا إلى الترحيب والملف الشخصي.
 */
export function RequireSession() {
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);
  const location = useLocation();

  if (status === "unknown") return <AppSplash />;
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!user?.isStaff && !OPEN_TO_ANY_ACCOUNT.includes(location.pathname)) {
    return <Navigate to="/welcome" replace />;
  }

  return <Outlet />;
}
