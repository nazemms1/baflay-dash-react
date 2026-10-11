import { lazy } from "react";

/*
 * الصفحات الكبيرة تُحمَّل عند أول زيارة لها، فيظهر مؤشر التحميل في مكان الصفحة بدل شاشة فارغة،
 * ويصغر حجم الحزمة الأولى. وحدات الجداول (CRUD) تبقى محمّلة مع التطبيق.
 */
export const HomeRoute = lazy(() => import("@/features/welcome/HomeRoute").then((m) => ({ default: m.HomeRoute })));
export const WelcomePage = lazy(() => import("@/features/welcome/WelcomePage").then((m) => ({ default: m.WelcomePage })));
export const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
export const OrdersPage = lazy(() => import("@/features/orders/OrdersPage").then((m) => ({ default: m.OrdersPage })));
export const CreateOrderPage = lazy(() => import("@/features/orders/CreateOrderPage").then((m) => ({ default: m.CreateOrderPage })));
export const IngredientsPage = lazy(() => import("@/features/ingredients/IngredientsPage").then((m) => ({ default: m.IngredientsPage })));
export const OrderExtrasPage = lazy(() => import("@/features/order-extras/OrderExtrasPage").then((m) => ({ default: m.OrderExtrasPage })));
