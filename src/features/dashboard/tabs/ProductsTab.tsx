import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/ui/Panel";
import { ShareBar, Skeleton } from "@/components/ui/Bars";
import { EmptyState } from "@/components/ui/States";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { QueryBody } from "../QueryBody";
import { QuickLink } from "../QuickLink";
import type { NamedAmount, Products } from "../types";

export function ProductsTab({ query }: { query: UseQueryResult<Products> }) {
  return (
    <QueryBody query={query} skeleton={<Skeleton className="h-80" />}>
      {(data) => <ProductsContent data={data} />}
    </QueryBody>
  );
}

function ProductsContent({ data }: { data: Products }) {
  const { t } = useTranslation();
  const { sandwichUnits, mealUnits, mealSharePct } = data.variants;
  const totalUnits = sandwichUnits + mealUnits;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <RankedList
          title={t("dashboard.products.topItems.title")}
          description={t("dashboard.products.topItems.description")}
          rows={data.topItems}
          empty={t("dashboard.products.topItems.empty")}
          action={<QuickLink to="/items" label={t("dashboard.quick.items")} />}
        />
        <RankedList
          title={t("dashboard.products.addOns.title")}
          description={t("dashboard.products.addOns.description")}
          rows={data.topAddOns}
          empty={t("dashboard.products.addOns.empty")}
          tone="info"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel title={t("dashboard.products.variants.title")} description={t("dashboard.products.variants.description")} className="lg:col-span-5">
          {totalUnits === 0 ? (
            <EmptyState>{t("dashboard.products.variants.empty")}</EmptyState>
          ) : (
            <div className="space-y-5">
              <div className="flex h-4 w-full overflow-hidden rounded-full bg-line/60" role="img" aria-label={t("dashboard.products.variants.title")}>
                <div className="h-full bg-primary" style={{ width: `${mealSharePct}%` }} />
                <div className="h-full flex-1 bg-night-soft" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted">{t("dashboard.products.variants.meal")}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(mealUnits)}</p>
                  <p className="text-xs text-muted">{formatPercent(mealSharePct)}</p>
                </div>
                <div>
                  <p className="text-muted">{t("dashboard.products.variants.sandwich")}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{formatNumber(sandwichUnits)}</p>
                  <p className="text-xs text-muted">{formatPercent(100 - mealSharePct)}</p>
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel title={t("dashboard.products.neverOrdered.title")} description={t("dashboard.products.neverOrdered.description")} className="lg:col-span-7">
          {data.neverOrdered.length === 0 ? (
            <EmptyState>{t("dashboard.products.neverOrdered.empty")}</EmptyState>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.neverOrdered.map((item) => (
                <li key={`${item.id ?? item.name}`} className="rounded-full bg-line/50 px-3 py-1 text-sm text-ink-soft">
                  {item.name || t("common.unnamed")}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function RankedList({
  title,
  description,
  action,
  rows,
  empty,
  tone = "primary",
}: {
  title: string;
  description: string;
  rows: NamedAmount[];
  empty: string;
  tone?: "primary" | "info";
  /** رابط سريع في رأس القائمة، كالانتقال إلى الأصناف من أكثرها مبيعاً. */
  action?: ReactNode;
}) {
  const max = Math.max(0, ...rows.map((row) => row.quantity));

  return (
    <Panel title={title} description={description} action={action}>
      {rows.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ol className="space-y-4">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-muted tabular-nums">{formatNumber(index + 1)}</span>
                  <span className="truncate font-medium">{row.name}</span>
                </span>
                <span className="shrink-0 text-muted tabular-nums">
                  {formatNumber(row.quantity)} · {formatMoney(row.revenue, row.currency)}
                </span>
              </div>
              <ShareBar value={row.quantity} max={max} tone={tone} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
