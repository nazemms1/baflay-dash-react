import {
  Bike,
  BookOpen,
  Carrot,
  ClipboardList,
  Gamepad2,
  Globe,
  Images,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingBag,
  PlusCircle,
  ShoppingCart,
  Store,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * القائمة الجانبية تُبنى من هذا الجدول وحده. كل بند يحمل صلاحيته، فلا يظهر
 * ما لا يستطيع الحساب فتحه أصلاً.
 *
 *   permission  اسم مسار كامل: `branches.index`
 *   prefix      بادئة لشاشة تقرأ عدّة مسارات: `admin.dashboard`
 */
export interface NavItem {
  /** مفتاح الترجمة: `nav.<key>`. */
  key: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
  prefix?: string;
}

export interface NavGroup {
  key: "overview" | "catalog" | "sales" | "customers" | "admin";
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    items: [
      { key: "home", path: "/", icon: LayoutDashboard, prefix: "admin.dashboard" },
    ],
  },
  {
    key: "catalog",
    items: [
      { key: "branches", path: "/branches", icon: Store, permission: "branches.index" },
      { key: "categories", path: "/categories", icon: Tags, permission: "categories.index" },
      { key: "items", path: "/items", icon: Package, permission: "items.index" },
      { key: "menus", path: "/menus", icon: BookOpen, permission: "menus.index" },
      { key: "ingredients", path: "/ingredients", icon: Carrot, permission: "ingredients.menus.show" },
      { key: "galleries", path: "/galleries", icon: Images, permission: "galleries.index" },
    ],
  },
  {
    key: "sales",
    items: [
      { key: "orders", path: "/orders", icon: ShoppingBag, prefix: "admin.orders" },
      { key: "createOrder", path: "/create-order", icon: ShoppingCart, permission: "admin.orders.counter.store" },
      { key: "orderExtras", path: "/order-extras", icon: PlusCircle, permission: "order-extras.show" },
      { key: "driverOrders", path: "/driver-orders", icon: Bike, prefix: "driver.orders" },
      { key: "driverAccounts", path: "/driver-accounts", icon: Wallet, permission: "admin.orders.driver-report" },
    ],
  },
  {
    key: "customers",
    items: [
      { key: "surveyAnswers", path: "/survey-answers", icon: ClipboardList, prefix: "customer.surveys" },
      { key: "surveyTemplates", path: "/survey-templates", icon: ClipboardList, permission: "surveys.index" },
      { key: "contactUs", path: "/contact-us", icon: MessageSquare, permission: "contact-us.index" },
    ],
  },
  {
    key: "admin",
    items: [
      { key: "users", path: "/users", icon: Users, permission: "users.index" },
      { key: "roles", path: "/roles", icon: ShieldCheck, permission: "roles.show" },
      { key: "countries", path: "/countries", icon: Globe, permission: "countries.index" },
      { key: "cities", path: "/cities", icon: MapPin, permission: "cities.index" },
      { key: "game", path: "/game-dashboard", icon: Gamepad2, permission: "game.players.delete" },
    ],
  },
];

/** الصلاحيات كما تعرضها الواجهة: هل يملك مساراً بعينه، أو أياً من مسارات بادئة. */
export interface PermissionCheck {
  has(name: string): boolean;
  hasPrefix(prefix: string): boolean;
}

/** البند يظهر لمن يملك صلاحيته، ولا يظهر بند بلا صلاحية محددة أصلاً. */
export function canSeeItem(item: NavItem, permissions: PermissionCheck): boolean {
  if (item.prefix) return permissions.hasPrefix(item.prefix);
  if (item.permission) return permissions.has(item.permission);
  return false;
}

