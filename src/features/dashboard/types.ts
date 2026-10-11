/**
 * نموذج الداشبورد كما تعرضه الواجهة. الأسماء هنا camelCase والقيم مُطبَّعة،
 * فلا تعرف الشاشات شيئاً عن شكل JSON الخادم.
 */

export type Period = "today" | "yesterday" | "7d" | "30d" | "90d" | "all";
export type PeriodChoice = Period | "custom";
export type DashboardTab = "overview" | "operations" | "products" | "customers";

export interface DashboardFilters {
  /** الفترة الجاهزة. تُتجاهل حين يكون المدى المخصّص مكتملاً. */
  period: Period;
  from: string | null;
  to: string | null;
  branchId: number | null;
}

export type AlertSeverity = "critical" | "warning" | "info";

export interface RevenueRow {
  currency: string;
  total: number;
  orders: number;
  averageBasket: number;
  changePct: number | null;
}

export interface TrendPoint {
  date: string;
  orders: number;
  revenue: number;
}

export interface BranchRank {
  id: number | null;
  name: string;
  nameAr: string;
  currency: string;
  accepting: boolean;
  orders: number;
  revenue: number;
  averageBasket: number;
  changePct: number | null;
}

export interface Alert {
  code: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  count: number;
}

/** نسب الترويج: كم طلباً من طلبات الفترة أضاف إليه الزبون إضافات، أو صلصات، أو كومبو. */
export interface Upsell {
  ordersInPeriod: number;
  addOns: { pct: number; orders: number };
  extras: { pct: number; orders: number };
  combo: { pct: number; orders: number };
}

export interface Overview {
  generatedAt: string | null;
  periodLabel: string;
  mainCurrency: string;
  revenues: RevenueRow[];
  upsell: Upsell;
  orders: {
    placed: number;
    completed: number;
    cancelled: number;
    rejected: number;
    lostPct: number;
    changePct: number | null;
    byStatus: { status: string; count: number }[];
  };
  live: {
    openNow: number;
    lateNow: number;
    oldestMinutes: number;
    lateAfterMinutes: number;
  };
  satisfaction: {
    averageRating: number | null;
    ratings: number;
    responsePct: number;
  };
  trend: TrendPoint[];
  topBranches: BranchRank[];
  alerts: Alert[];
}

export interface QueueRow {
  orderNumber: string;
  branchName: string;
  status: string;
  total: number;
  currency: string;
  waitingMinutes: number;
  isLate: boolean;
}

export interface Operations {
  queue: QueueRow[];
  branches: { name: string; openOrders: number; lateOrders: number; oldestMinutes: number }[];
  carts: { total: number; withItems: number; abandonmentPct: number };
  rejections: { reason: string; orders: number }[];
}

export interface NamedAmount {
  name: string;
  quantity: number;
  revenue: number;
  currency: string;
}

export interface Products {
  topItems: NamedAmount[];
  topAddOns: NamedAmount[];
  variants: { sandwichUnits: number; mealUnits: number; mealSharePct: number };
  neverOrdered: { id: number | null; name: string }[];
}

export interface Customers {
  averageRating: number | null;
  ratings: number;
  responsePct: number;
  /** من خمس نجوم إلى نجمة واحدة، حتى لو غاب بعضها في الجواب. */
  distribution: { stars: number; count: number }[];
  recentReviews: {
    orderNumber: string;
    rating: number;
    note: string | null;
    customerName: string;
    branchName: string;
    ratedAt: string | null;
  }[];
}
