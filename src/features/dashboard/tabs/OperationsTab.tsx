import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShoppingBag, Truck } from "lucide-react";
import { BranchStatusPill } from "@/features/branches/BranchStatusBadge";
import { Panel } from "@/components/ui/Panel";
import { ShareBar, Skeleton } from "@/components/ui/Bars";
import { EmptyState } from "@/components/ui/States";
import { ResponsiveRecordList, type RecordColumn } from "@/components/ui/ResponsiveRecordList";
import { formatMoney, formatNumber, formatPercent, formatWait } from "@/lib/format";
import { QueryBody } from "../QueryBody";
import { KpiTile, OrderStatus } from "../parts";
import { QuickLink } from "../QuickLink";
import type { Operations, OrderTypeName } from "../types";

type QueueRow = Operations["queue"][number];

/**
 * أنواع الطلب التي يعرضها الفرع الآن، بأيقونة لكل نوع. لا شيء يظهر إن لم يرسلها الخادم،
 * وفرع بلا نوع معروض تكفيه شارة «مغلق» بسببها.
 */
function BranchOrderTypes({ types }: { types: OrderTypeName[] }) {
  const { t } = useTranslation();
  if (types.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      {types.includes("delivery") && (
        <span title={t("crud.field.isAcceptingDelivery")} className="inline-flex">
          <Truck className="size-4" aria-hidden />
          <span className="sr-only">{t("crud.field.isAcceptingDelivery")}</span>
        </span>
      )}
      {types.includes("pickup") && (
        <span title={t("orderTypes.pickupField")} className="inline-flex">
          <ShoppingBag className="size-4" aria-hidden />
          <span className="sr-only">{t("orderTypes.pickupField")}</span>
        </span>
      )}
    </span>
  );
}

export function OperationsTab({ query }: { query: UseQueryResult<Operations> }) {
  return (
    <QueryBody query={query} skeleton={<Skeleton className="h-80" />}>
      {(data) => <OperationsContent data={data} />}
    </QueryBody>
  );
}

function OperationsContent({ data }: { data: Operations }) {
  const { t } = useTranslation();
  const lateCount = data.queue.filter((order) => order.isLate).length;
  const maxOpen = Math.max(0, ...data.branches.map((branch) => branch.openOrders));

  // طابور الطلبات: جدول على الشاشات الواسعة، وكروت على الهاتف.
  const queueColumns: RecordColumn<QueueRow>[] = [
    {
      key: "order",
      header: t("dashboard.ops.queue.order"),
      cell: (order) => <span className="font-medium tabular-nums">{order.orderNumber}</span>,
    },
    {
      key: "branch",
      header: t("dashboard.ops.queue.branch"),
      cell: (order) => <span className="text-ink-soft">{order.branchName}</span>,
    },
    {
      key: "status",
      header: t("dashboard.ops.queue.status"),
      cell: (order) => <OrderStatus status={order.status} />,
    },
    {
      key: "total",
      header: t("dashboard.ops.queue.total"),
      align: "end",
      cell: (order) => <span className="tabular-nums">{formatMoney(order.total, order.currency)}</span>,
    },
    {
      key: "waiting",
      header: t("dashboard.ops.queue.waiting"),
      align: "end",
      cell: (order) => (
        <span className={order.isLate ? "font-medium tabular-nums text-danger" : "tabular-nums text-ink-soft"}>
          {formatWait(order.waitingMinutes)}
        </span>
      ),
    },
  ];

  const renderQueueCard = (order: QueueRow) => (
    <article className="space-y-3 rounded-2xl border border-line bg-canvas/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold tabular-nums text-ink">{order.orderNumber}</p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{order.branchName}</p>
        </div>
        <OrderStatus status={order.status} />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{t("dashboard.ops.queue.total")}</p>
          <p className="text-lg font-bold tabular-nums text-ink">{formatMoney(order.total, order.currency)}</p>
        </div>
        <div className="text-end">
          <p className="text-xs text-muted">{t("dashboard.ops.queue.waiting")}</p>
          <p className={order.isLate ? "font-semibold tabular-nums text-danger" : "font-medium tabular-nums text-ink-soft"}>
            {formatWait(order.waitingMinutes)}
          </p>
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTile label={t("dashboard.ops.openOrders")} value={formatNumber(data.queue.length)} />
        <KpiTile
          label={t("dashboard.ops.late")}
          value={formatNumber(lateCount)}
          tone={lateCount > 0 ? "danger" : "default"}
        />
        <KpiTile
          label={t("dashboard.ops.abandonedCarts")}
          value={formatNumber(data.carts.total)}
          hint={t("dashboard.ops.withItems", { count: data.carts.withItems })}
        />
        <KpiTile
          label={t("dashboard.ops.abandonmentRate")}
          value={formatPercent(data.carts.abandonmentPct)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          title={t("dashboard.ops.queue.title")}
          description={t("dashboard.ops.queue.description")}
          className="lg:col-span-8"
          action={<QuickLink to="/orders" label={t("dashboard.quick.orders")} />}
        >
          {data.queue.length === 0 ? (
            <EmptyState>{t("dashboard.ops.queue.empty")}</EmptyState>
          ) : (
            // الهامش السالب يُخرج الجدول إلى حواف البطاقة، كما كان قبل التجاوب.
            <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
              <ResponsiveRecordList
                label={t("dashboard.ops.queue.title")}
                rows={data.queue}
                getKey={(order) => order.orderNumber}
                columns={queueColumns}
                renderCard={renderQueueCard}
              />
            </div>
          )}
        </Panel>

        <Panel title={t("dashboard.ops.load.title")} description={t("dashboard.ops.load.description")} className="lg:col-span-4">
          {data.branches.length === 0 ? (
            <EmptyState>{t("dashboard.ops.load.empty")}</EmptyState>
          ) : (
            <ul className="space-y-4">
              {data.branches.map((branch) => (
                <li key={branch.name} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{branch.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatNumber(branch.openOrders)}
                      {branch.lateOrders > 0 && (
                        <span className="ms-2 text-danger">
                          {t("dashboard.ops.load.late", { count: branch.lateOrders })}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* الحالة والأنواع المعروضة من الخادم؛ ما لم يرسله الخادم لا يظهر منه شيء. */}
                  {(branch.status !== "unknown" || branch.offeredOrderTypes.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {branch.status !== "unknown" && <BranchStatusPill status={branch.status} />}
                      <BranchOrderTypes types={branch.offeredOrderTypes} />
                    </div>
                  )}
                  <ShareBar value={branch.openOrders} max={maxOpen} tone={branch.lateOrders > 0 ? "danger" : "primary"} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t("dashboard.ops.rejections.title")} description={t("dashboard.ops.rejections.description")}>
        {data.rejections.length === 0 ? (
          <EmptyState>{t("dashboard.ops.rejections.empty")}</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {data.rejections.map((row) => (
              <li key={row.reason} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>{row.reason || t("common.unnamed")}</span>
                <span className="font-semibold tabular-nums">{formatNumber(row.orders)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
