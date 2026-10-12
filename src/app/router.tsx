import type { ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import { PageErrorScreen, RenderErrorScreen } from "@/components/ErrorScreen";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireSession } from "@/features/auth/RequireSession";
import { PendingModulePage } from "@/pages/PendingModulePage";
import {
  CreateOrderPage,
  DriverAccountsPage,
  DriverOrdersPage,
  HomeRoute,
  IngredientsPage,
  OrderExtrasPage,
  OrdersPage,
  ProfilePage,
  WelcomePage,
} from "./pages";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AppShell } from "@/layouts/AppShell";
import { NAV_GROUPS } from "@/layouts/navigation";
import { ModuleRoute } from "@/modules/ModuleRoute";
import {
  branchesModule,
  categoriesModule,
  citiesModule,
  countriesModule,
  itemsModule,
  menusModule,
} from "@/modules/catalog";
import { contactUsModule, rolesModule } from "@/modules/people";
import { UsersRoute } from "@/modules/UsersRoute";
import { galleriesModule } from "@/modules/content";
import { customerSurveysModule, surveysModule } from "@/modules/surveys";
import { gameModule } from "@/modules/game";

/** الوحدات المنقولة بشاشة CRUD كاملة، ومفتاحها مسار الوحدة في القائمة. */
const CRUD_ROUTES = [
  { path: "countries", element: <ModuleRoute build={countriesModule} /> },
  { path: "cities", element: <ModuleRoute build={citiesModule} /> },
  { path: "categories", element: <ModuleRoute build={categoriesModule} /> },
  { path: "branches", element: <ModuleRoute build={branchesModule} /> },
  { path: "items", element: <ModuleRoute build={itemsModule} /> },
  { path: "ingredients", element: <IngredientsPage /> },
  { path: "menus", element: <ModuleRoute build={menusModule} /> },
  { path: "galleries", element: <ModuleRoute build={galleriesModule} /> },
  { path: "users", element: <UsersRoute /> },
  { path: "roles", element: <ModuleRoute build={rolesModule} /> },
  { path: "contact-us", element: <ModuleRoute build={contactUsModule} /> },
  { path: "survey-templates", element: <ModuleRoute build={surveysModule} /> },
  { path: "survey-answers", element: <ModuleRoute build={customerSurveysModule} /> },
  { path: "orders", element: <OrdersPage /> },
  { path: "game-dashboard", element: <ModuleRoute build={gameModule} /> },
  { path: "create-order", element: <CreateOrderPage /> },
  { path: "order-extras", element: <OrderExtrasPage /> },
  { path: "driver-orders", element: <DriverOrdersPage /> },
  { path: "driver-accounts", element: <DriverAccountsPage /> },
];

const IMPLEMENTED = new Set(["/", ...CRUD_ROUTES.map((route) => `/${route.path}`)]);

/** وحدات القائمة التي لم تُنقل بعد تفتح صفحة "قيد النقل" بدل أن تنكسر. */
const pendingRoutes = NAV_GROUPS.flatMap((group) => group.items)
  .filter((item) => !IMPLEMENTED.has(item.path))
  .map((item) => ({
    path: item.path.slice(1),
    element: <PendingModulePage titleKey={`nav.${item.key}`} />,
  }));

/** خطأ الصفحة يظهر داخل الإطار نفسه، فتبقى القائمة الجانبية تعمل للتنقل إلى صفحة أخرى. */
const withPageErrors = (routes: { path: string; element: ReactNode }[]) =>
  routes.map((route) => ({ ...route, errorElement: <PageErrorScreen /> }));

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RenderErrorScreen /> },
  {
    element: <RequireSession />,
    errorElement: <RenderErrorScreen />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomeRoute />, errorElement: <PageErrorScreen /> },
          { path: "welcome", element: <WelcomePage />, errorElement: <PageErrorScreen /> },
          { path: "profile", element: <ProfilePage />, errorElement: <PageErrorScreen /> },
          ...withPageErrors(CRUD_ROUTES),
          ...withPageErrors(pendingRoutes),
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
