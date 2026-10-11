import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, CircleAlert, Clock, Info, ShoppingBag, Star, Timer, TrendingDown, TriangleAlert } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { ShareBar, Skeleton } from "@/components/ui/Bars";
import { EmptyState } from "@/components/ui/States";
import { currentLanguage } from "@/i18n";
import { formatDay, formatMoney, formatNumber, formatPercent, formatWait } from "@/lib/format";
import { localizedName } from "@/lib/localized";
import { QueryBody } from "../QueryBody";
import { ChangeChip, KpiTile } from "../parts";
import { QuickLink } from "../QuickLink";
import type { Alert, AlertSeverity, BranchRank, Overview, RevenueRow, TrendPoint, Upsell } from "../types";

export function OverviewTab({ query }: { query: UseQueryResult<Overview> }) {
  return (
    <QueryBody query={query} skeleton={<OverviewSkeleton />}>
      {(data) => <OverviewContent data={data} />}
    </QueryBody>
  );
}

function OverviewContent({ data }: { data: Overview }) {
  const { t } = useTranslation();
  const main = data.revenues[0];
  const otherRevenues = data.revenues.slice(1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-12">
        <RevenueHero
          main={main}
          others={otherRevenues}
          orders={data.orders.placed}
          periodLabel={data.periodLabel}
        />

        <div className="grid grid-cols-2 gap-4 lg:col-span-5">
          <KpiTile
            label={t("dashboard.kpi.orders")}
            value={formatNumber(data.orders.placed)}
            icon={ShoppingBag}
            hint={<ChangeChip value={data.orders.changePct} />}
          />
          <KpiTile
            label={t("dashboard.kpi.completed")}
            value={formatNumber(data.orders.completed)}
            icon={CheckCircle2}
            hint={t("dashboard.kpi.cancelledRejected", {
              cancelled: formatNumber(data.orders.cancelled),
              rejected: formatNumber(data.orders.rejected),
            })}
          />
          <KpiTile
            label={t("dashboard.kpi.lost")}
            value={formatPercent(data.orders.lostPct)}
            icon={TrendingDown}
            tone={data.orders.lostPct > 0 ? "danger" : "default"}
            hint={t("dashboard.kpi.lostHint")}
          />
          <KpiTile
            label={t("dashboard.kpi.rating")}
            value={data.satisfaction.averageRating === null ? "—" : formatNumber(data.satisfaction.averageRating, { maximumFractionDigits: 1 })}
            icon={Star}
            hint={t("dashboard.kpi.ratingsCount", { count: data.satisfaction.ratings })}
          />
        </div>
      </div>

      <AlertsPanel alerts={data.alerts} />

      <div className="grid gap-4 lg:grid-cols-12">
        <TrendPanel trend={data.trend} currency={data.mainCurrency} className="lg:col-span-8" />
        <LivePanel data={data.live} className="lg:col-span-4" />
      </div>

      <BranchRankingPanel branches={data.topBranches} />

      <UpsellPanel upsell={data.upsell} />
    </div>
  );
}

/** نسب الترويج: كم من طلبات الفترة حملت إضافة، أو صلصة، أو كومبو، مع عدد الطلبات لكل نوع. */
function UpsellPanel({ upsell }: { upsell: Upsell }) {
  const { t } = useTranslation();
  const rows = [
    { key: "addOns", label: t("dashboard.addOns"), ...upsell.addOns },
    { key: "extras", label: t("dashboard.extras"), ...upsell.extras },
    { key: "combo", label: t("dashboard.combo"), ...upsell.combo },
  ];

  return (
    <Panel title={t("dashboard.upsellRates")}>
      <ul className="space-y-5">
        {rows.map((row) => (
          <li key={row.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{row.label}</span>
              <span className="font-semibold tabular-nums text-ink">{formatPercent(row.pct)}</span>
            </div>
            <ShareBar value={row.pct} max={100} />
            <p className="text-xs text-muted tabular-nums">
              {t("dashboard.ordersOf", { count: formatNumber(row.orders), total: formatNumber(upsell.ordersInPeriod) })}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RevenueHero({
  main,
  others,
  orders,
  periodLabel,
}: {
  main: RevenueRow | undefined;
  others: RevenueRow[];
  orders: number;
  periodLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <section className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-night p-6 text-surface shadow-[0_12px_32px_-16px_rgba(63,62,60,0.55)] lg:col-span-7">
      {/* وهج أصفر من الهوية في الزاوية، يمنح البطاقة عمقاً دون أن يشوّش الرقم، والمحتوى فوقه. */}
      <span aria-hidden className="pointer-events-none absolute -top-24 -end-24 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-surface/60">{t("dashboard.hero.revenue")}</p>
          {periodLabel && <p className="mt-0.5 text-xs text-surface/40">{periodLabel}</p>}
        </div>
        {main && <ChangeChip value={main.changePct} />}
      </div>

      <div className="relative">
        <p className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
          {main ? formatMoney(main.total, main.currency) : "—"}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-surface/70">
          <span>{t("dashboard.hero.orders", { count: orders })}</span>
          {main && (
            <span>
              {t("dashboard.hero.averageBasket")}: {formatMoney(main.averageBasket, main.currency)}
            </span>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div className="relative flex flex-wrap gap-2 border-t border-night-line pt-4">
          {others.map((row) => (
            <span
              key={row.currency}
              className="rounded-full bg-night-soft px-3 py-1 text-sm tabular-nums"
            >
              {formatMoney(row.total, row.currency)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
  currency: string;
}

/** بطاقة تفاصيل نقطة الرسم: التاريخ ثم الإيراد بخط واضح، بدل الصندوق الافتراضي للمكتبة. */
function TrendTooltip({ active, payload, label, currency }: TrendTooltipProps) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="text-xs text-muted">{formatDay(String(label))}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">
        {formatMoney(Number(payload[0]?.value ?? 0), currency)}
      </p>
      <p className="text-[11px] text-muted">{t("dashboard.trend.revenue")}</p>
    </div>
  );
}

const SEVERITY: Record<AlertSeverity, { icon: typeof CircleAlert; box: string; text: string }> = {
  critical: { icon: CircleAlert, box: "bg-danger-soft", text: "text-danger" },
  warning: { icon: TriangleAlert, box: "bg-warn-soft", text: "text-warn" },
  info: { icon: Info, box: "bg-info-soft", text: "text-info" },
};

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const { t } = useTranslation();

  return (
    <Panel title={t("dashboard.alerts.title")} description={t("dashboard.alerts.description")}>
      {alerts.length === 0 ? (
        <EmptyState>{t("dashboard.alerts.empty")}</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {alerts.map((alert) => {
            const style = SEVERITY[alert.severity];
            const Icon = style.icon;
            return (
              <li key={alert.code} className={`flex gap-3 rounded-xl p-4 ${style.box}`}>
                <Icon className={`mt-0.5 size-5 shrink-0 ${style.text}`} aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-ink">{alert.title}</p>
                  {alert.detail && <p className="text-sm text-ink-soft">{alert.detail}</p>}
                </div>
                {alert.count > 0 && (
                  <span className={`shrink-0 self-start text-lg font-bold tabular-nums ${style.text}`}>
                    {formatNumber(alert.count)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function TrendPanel({
  trend,
  currency,
  className,
}: {
  trend: TrendPoint[];
  currency: string;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Panel
      title={t("dashboard.trend.title")}
      description={currency ? t("dashboard.trend.descriptionCurrency", { currency }) : undefined}
      className={className}
    >
      {trend.length === 0 ? (
        <EmptyState>{t("dashboard.trend.empty")}</EmptyState>
      ) : (
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fec55f" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#fec55f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e6e0d3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatDay(value)}
                tick={{ fill: "#8a8577", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: "#8a8577", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(value: number) => formatNumber(value, { notation: "compact" })}
              />
              <Tooltip cursor={{ stroke: "#e6e0d3", strokeWidth: 1 }} content={<TrendTooltip currency={currency} />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#bf3c3c"
                strokeWidth={2}
                fill="url(#trendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function LivePanel({
  data,
  className,
}: {
  data: Overview["live"];
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Panel
      title={t("dashboard.live.title")}
      description={t("dashboard.live.description")}
      className={className}
      action={<QuickLink to="/orders" label={t("dashboard.quick.orders")} />}
    >
      <div className="grid grid-cols-2 gap-3">
        <KpiTile label={t("dashboard.live.open")} value={formatNumber(data.openNow)} icon={Clock} />
        <KpiTile
          label={t("dashboard.live.late")}
          value={formatNumber(data.lateNow)}
          icon={Timer}
          tone={data.lateNow > 0 ? "danger" : "default"}
        />
      </div>
      <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t("dashboard.live.oldest")}</span>
          <span className="font-medium tabular-nums">{formatWait(data.oldestMinutes)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">{t("dashboard.live.lateAfter")}</span>
          <span className="font-medium tabular-nums">{formatWait(data.lateAfterMinutes)}</span>
        </div>
      </div>
    </Panel>
  );
}

function BranchRankingPanel({ branches }: { branches: BranchRank[] }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const ranked = [...branches].sort((a, b) => b.orders - a.orders);
  const maxOrders = ranked[0]?.orders ?? 0;

  return (
    <Panel
      title={t("dashboard.branches.title")}
      description={t("dashboard.branches.description")}
      action={<QuickLink to="/branches" label={t("dashboard.quick.branches")} />}
    >
      {ranked.length === 0 ? (
        <EmptyState>{t("dashboard.branches.empty")}</EmptyState>
      ) : (
        <ol className="divide-y divide-line">
          {ranked.map((branch, index) => (
            <li key={branch.id ?? index} className="grid gap-3 py-3 md:grid-cols-[1fr_2fr_auto] md:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums ${
                    index < 3 ? "bg-primary text-ink" : "bg-canvas text-muted"
                  }`}
                >
                  {formatNumber(index + 1)}
                </span>
                <span className="truncate font-medium">
                  {localizedName({ name: branch.name, nameAr: branch.nameAr }, language)}
                </span>
                {!branch.accepting && (
                  <span className="shrink-0 text-xs text-warn">{t("dashboard.branches.closed")}</span>
                )}
              </div>
              <ShareBar value={branch.orders} max={maxOrders} />
              <div className="flex items-center gap-3 text-sm tabular-nums md:justify-end">
                <span className="font-medium">{t("dashboard.branches.orders", { count: branch.orders })}</span>
                <span className="text-muted">{formatMoney(branch.revenue, branch.currency)}</span>
                <ChangeChip value={branch.changePct} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-56 lg:col-span-7" />
        <div className="grid grid-cols-2 gap-4 lg:col-span-5">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
