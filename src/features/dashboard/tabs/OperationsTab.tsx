import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/ui/Panel";
import { ShareBar, Skeleton } from "@/components/ui/Bars";
import { EmptyState } from "@/components/ui/States";
import { formatMoney, formatNumber, formatPercent, formatWait } from "@/lib/format";
import { QueryBody } from "../QueryBody";
import { KpiTile, OrderStatus } from "../parts";
import { QuickLink } from "../QuickLink";
import type { Operations } from "../types";

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-secondary text-xs font-semibold text-surface">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2 text-start font-medium">{t("dashboard.ops.queue.order")}</th>
                    <th className="px-3 py-2 text-start font-medium">{t("dashboard.ops.queue.branch")}</th>
                    <th className="px-3 py-2 text-start font-medium">{t("dashboard.ops.queue.status")}</th>
                    <th className="px-3 py-2 text-end font-medium">{t("dashboard.ops.queue.total")}</th>
                    <th className="px-5 py-2 text-end font-medium">{t("dashboard.ops.queue.waiting")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.queue.map((order) => (
                    <tr key={order.orderNumber} className="border-b border-line/60 last:border-0">
                      <td className="px-5 py-3 font-medium tabular-nums">{order.orderNumber}</td>
                      <td className="px-3 py-3 text-ink-soft">{order.branchName}</td>
                      <td className="px-3 py-3">
                        <OrderStatus status={order.status} />
                      </td>
                      <td className="px-3 py-3 text-end tabular-nums">
                        {formatMoney(order.total, order.currency)}
                      </td>
                      <td
                        className={
                          order.isLate
                            ? "px-5 py-3 text-end font-medium text-danger tabular-nums"
                            : "px-5 py-3 text-end text-ink-soft tabular-nums"
                        }
                      >
                        {formatWait(order.waitingMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
