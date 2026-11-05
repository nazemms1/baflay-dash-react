import { closedReasonStatus, type BranchStatus } from "@/features/branches/branchStatus";
import { asArray, asRecord, toNullableNumber, toNumber, toText, type UnknownRecord } from "@/lib/coerce";
import type {
  Alert,
  AlertSeverity,
  BranchLoad,
  BranchRank,
  Customers,
  Operations,
  OrderTypeName,
  Overview,
  Products,
  QueueRow,
  RevenueRow,
  TrendPoint,
  Upsell,
} from "./types";

/**
 * تطبيع جواب الخادم. كل حقل يُقرأ بقيمة افتراضية آمنة، فحقل غائب لا يكسر
 * الشاشة. أسماء الحقول مأخوذة من جواب الخادم نفسه.
 */

const rows = (value: unknown) => asArray<UnknownRecord>(value);

const CRITICAL = new Set(["critical", "high", "danger", "error"]);
const WARNING = new Set(["warning", "medium", "warn"]);

function toSeverity(value: unknown): AlertSeverity {
  const level = toText(value).toLowerCase();
  if (CRITICAL.has(level)) return "critical";
  if (WARNING.has(level)) return "warning";
  return "info";
}

function toRevenueRow(row: UnknownRecord): RevenueRow {
  return {
    currency: toText(row.currency),
    total: toNumber(row.total),
    orders: toNumber(row.orders),
    averageBasket: toNumber(row.average_basket),
    changePct: toNullableNumber(row.change_pct),
  };
}

function toBranchRank(row: UnknownRecord): BranchRank {
  return {
    id: toNullableNumber(row.branch_id),
    name: toText(row.name) || toText(row.name_ar),
    nameAr: toText(row.name_ar),
    currency: toText(row.currency),
    accepting: row.is_accepting_orders !== false,
    orders: toNumber(row.orders),
    revenue: toNumber(row.revenue),
    averageBasket: toNumber(row.average_basket),
    changePct: toNullableNumber(row.change_pct),
  };
}

function toByStatus(value: unknown): { status: string; count: number }[] {
  return Object.entries(asRecord(value))
    .map(([status, count]) => ({ status, count: toNumber(count) }))
    .sort((a, b) => b.count - a.count);
}

export function toOverview(body: unknown): Overview {
  const root = asRecord(body);
  const kpis = asRecord(root.kpis);
  const orders = asRecord(kpis.orders);
  const live = asRecord(kpis.live);
  const satisfaction = asRecord(kpis.satisfaction);

  // الإيراد بعملات متعددة لا يُجمع: جمع الليرة بالدولار بلا معنى. الأكبر أولاً.
  const revenues = rows(kpis.revenue).map(toRevenueRow).sort((a, b) => b.total - a.total);
  const mainCurrency = revenues[0]?.currency ?? "";

  // خط الاتجاه يُبنى على العملة الرئيسية فقط، لأن المجموع لا يُقارن عبر العملات.
  const trend: TrendPoint[] = rows(root.trend).map((row) => {
    const match = rows(row.revenue).find((entry) => toText(entry.currency) === mainCurrency);
    return {
      date: toText(row.date),
      orders: toNumber(row.orders),
      revenue: toNumber(match?.total),
    };
  });

  const alerts: Alert[] = rows(root.alerts).map((row) => ({
    code: toText(row.code),
    severity: toSeverity(row.severity),
    title: toText(row.title),
    detail: toText(row.detail),
    count: toNumber(row.count),
  }));

  return {
    generatedAt: typeof root.generated_at === "string" ? root.generated_at : null,
    periodLabel: toText(asRecord(root.period).label),
    mainCurrency,
    revenues,
    orders: {
      placed: toNumber(orders.placed),
      completed: toNumber(orders.completed),
      cancelled: toNumber(orders.cancelled),
      rejected: toNumber(orders.rejected),
      lostPct: toNumber(orders.lost_pct),
      changePct: toNullableNumber(orders.change_pct),
      byStatus: toByStatus(orders.by_status),
    },
    live: {
      openNow: toNumber(live.open_now),
      lateNow: toNumber(live.late_now),
      oldestMinutes: toNumber(live.oldest_minutes),
      lateAfterMinutes: toNumber(live.late_after_minutes),
    },
    satisfaction: {
      averageRating: toNullableNumber(satisfaction.average_rating),
      ratings: toNumber(satisfaction.ratings),
      responsePct: toNumber(satisfaction.response_pct),
    },
    upsell: toUpsell(root.upsell),
    trend,
    topBranches: rows(root.top_branches).map(toBranchRank),
    alerts,
  };
}

/** نسب الترويج كما يعيدها الخادم في `upsell`، بالحقول الثلاثة وعدد طلباتها. */
function toUpsell(raw: unknown): Upsell {
  const upsell = asRecord(raw);
  const addOns = asRecord(upsell.add_ons);
  const extras = asRecord(upsell.extras);
  const combo = asRecord(upsell.combo);
  return {
    ordersInPeriod: toNumber(upsell.orders_in_period),
    addOns: { pct: toNumber(addOns.attach_rate_pct), orders: toNumber(addOns.orders_with) },
    extras: { pct: toNumber(extras.attach_rate_pct), orders: toNumber(extras.orders_with) },
    combo: { pct: toNumber(combo.take_rate_pct), orders: toNumber(combo.orders_with) },
  };
}

function toQueueRow(row: UnknownRecord): QueueRow {
  return {
    orderNumber: toText(row.order_number),
    branchName: toText(row.branch_name),
    status: toText(row.status),
    total: toNumber(row.total),
    currency: toText(row.currency),
    waitingMinutes: toNumber(row.waiting_minutes),
    isLate: row.is_late === true,
  };
}

/** حالة الفرع من `closed_reason`، وإن غاب فمن `is_open_now`: المفتوح مفتوح، وغيره مجهول السبب. */
function toLoadStatus(row: UnknownRecord): BranchStatus {
  if (row.closed_reason !== undefined) return closedReasonStatus(row.closed_reason);
  return row.is_open_now === true ? "open" : "unknown";
}

/** الأنواع المعروضة: ما يعرفه الواجهة فقط، بترتيب ثابت (التوصيل ثم الاستلام) مهما كان ترتيب الخادم. */
function toOfferedTypes(value: unknown): OrderTypeName[] {
  const offered = asArray<unknown>(value);
  return (["delivery", "pickup"] as const).filter((type) => offered.includes(type));
}

function toBranchLoad(row: UnknownRecord): BranchLoad {
  return {
    name: toText(row.name),
    openOrders: toNumber(row.open_orders),
    lateOrders: toNumber(row.late_orders),
    oldestMinutes: toNumber(row.oldest_minutes),
    status: toLoadStatus(row),
    offeredOrderTypes: toOfferedTypes(row.offered_order_types),
  };
}

export function toOperations(body: unknown): Operations {
  const root = asRecord(body);
  const carts = asRecord(root.abandoned_carts);

  return {
    queue: rows(root.queue).map(toQueueRow),
    branches: rows(root.by_branch).map(toBranchLoad),
    carts: {
      total: toNumber(carts.total),
      withItems: toNumber(carts.with_items),
      abandonmentPct: toNumber(carts.abandonment_pct),
    },
    rejections: rows(root.rejections).map((row) => ({
      reason: toText(row.reason),
      orders: toNumber(row.orders),
    })),
  };
}

export function toProducts(body: unknown): Products {
  const root = asRecord(body);
  const variants = asRecord(root.variants);
  const namedAmounts = (list: unknown) =>
    rows(list).map((row) => ({
      name: toText(row.item ?? row.name),
      quantity: toNumber(row.quantity),
      revenue: toNumber(row.revenue),
      currency: toText(row.currency),
    }));

  return {
    topItems: namedAmounts(root.top_items),
    topAddOns: namedAmounts(asRecord(root.add_ons).top),
    variants: {
      sandwichUnits: toNumber(variants.sandwich_units),
      mealUnits: toNumber(variants.meal_units),
      mealSharePct: toNumber(variants.meal_share_pct),
    },
    neverOrdered: rows(root.never_ordered).map((row) => ({
      id: toNullableNumber(row.id),
      name: toText(row.name),
    })),
  };
}

/** يعرض النجوم من الأعلى إلى الأدنى ويملأ الناقص بصفر، حتى يبقى المقياس ثابتاً. */
function toDistribution(value: unknown): { stars: number; count: number }[] {
  const source = asRecord(value);
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: toNumber(source[String(stars)]),
  }));
}

export function toCustomers(body: unknown): Customers {
  const root = asRecord(body);
  const satisfaction = asRecord(root.satisfaction);

  return {
    averageRating: toNullableNumber(satisfaction.average_rating),
    ratings: toNumber(satisfaction.ratings),
    responsePct: toNumber(satisfaction.response_pct),
    distribution: toDistribution(satisfaction.distribution),
    recentReviews: rows(root.recent_reviews).map((row) => ({
      orderNumber: toText(row.order_number),
      rating: toNumber(row.rating),
      note: typeof row.note === "string" && row.note ? row.note : null,
      customerName: toText(row.customer_name),
      branchName: toText(row.branch_name),
      ratedAt: typeof row.rated_at === "string" ? row.rated_at : null,
    })),
  };
}
