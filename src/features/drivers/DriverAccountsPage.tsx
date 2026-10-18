import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
import { Input } from "@/components/ui/Input";
import { SelectField } from "@/components/ui/Fields";
import { Panel } from "@/components/ui/Panel";
import { ResponsiveRecordList, type RecordColumn } from "@/components/ui/ResponsiveRecordList";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { currentLanguage } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { localizedRecord } from "@/lib/localized";
import { branches, orderAdmin } from "@/services";
import { ADMIN_DRIVER_PERMISSIONS } from "./permissions";
import { toBranchAccounts, todayIso, type BranchAccounts } from "./driverReport";

type DriverRow = BranchAccounts["drivers"][number];

/**
 * حساب السائقين للإدارة: لكل فرع جدول بسائقيه. لا مجموع بين الفروع، ومدير الفرع يرى فرعه وحده.
 * اليوم يُحسب من وقت إسناد الطلب، والأرقام تطابق ما يراه السائق في ملخصه.
 */
export function DriverAccountsPage() {
  const { t } = useTranslation();
  const language = currentLanguage();
  const permissions = usePermissions();
  const scope = useBranchScope();
  const [date, setDate] = useState(todayIso);
  const [branchFilter, setBranchFilter] = useState<number | null>(null);

  const canView = permissions.has(ADMIN_DRIVER_PERMISSIONS.report);
  const branchId = scope.isBranchScoped ? scope.branchId : branchFilter;

  const branchList = useQuery({
    queryKey: ["orders-page", "branches"],
    queryFn: async ({ signal }) => (await branches.list({ page: 1, per_page: 500 }, signal)).items,
    enabled: canView && !scope.isBranchScoped,
    staleTime: 5 * 60_000,
  });

  const report = useQuery({
    queryKey: ["driver-accounts", date, branchId, language],
    enabled: canView,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) =>
      toBranchAccounts(
        await orderAdmin.driverReport({ date: date || undefined, branch_id: branchId ?? undefined }, signal),
        language,
        t("drivers.accounts.allDrivers")
      ),
  });

  if (!canView) return <EmptyState>{t("drivers.accounts.noAccess")}</EmptyState>;

  const groups = report.data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-bold text-ink">{t("drivers.accounts.title")}</h2>
        <p className="text-sm text-muted">{t("drivers.accounts.hint")}</p>
      </header>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          label={t("ordersPage.dateFilter")}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <SelectField
          label={t("ordersPage.branchFilter")}
          options={(branchList.data ?? []).map((row) => ({
            value: Number(row.id),
            label: localizedRecord(row, language) || `#${row.id}`,
          }))}
          value={branchId}
          disabled={scope.isBranchScoped}
          placeholder={t("ordersPage.allBranches")}
          onChange={(value) => setBranchFilter(value === null ? null : Number(value))}
        />
      </section>

      {report.isPending ? (
        <Skeleton className="h-64" />
      ) : report.isError ? (
        <ErrorState message={t("errors.unexpected")} onRetry={() => void report.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState>{t("drivers.accounts.empty")}</EmptyState>
      ) : (
        groups.map((group) => <BranchTable key={group.key} group={group} />)
      )}

      <Panel title={t("drivers.accounts.definitionsTitle")}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Definition term={t("drivers.accounts.cashToHandIn")} text={t("drivers.accounts.def.cashToHandIn")} />
          <Definition term={t("drivers.accounts.cashInTransit")} text={t("drivers.accounts.def.cashInTransit")} />
          <Definition term={t("drivers.accounts.failedCash")} text={t("drivers.accounts.def.failedCash")} />
          <Definition term={t("drivers.accounts.failedCardOrders")} text={t("drivers.accounts.def.failedCardOrders")} />
          <Definition term={t("drivers.accounts.counts")} text={t("drivers.accounts.def.counts")} />
          <Definition term={t("drivers.accounts.dayRuleTitle")} text={t("drivers.accounts.dayRule")} />
        </dl>
      </Panel>
    </div>
  );
}

function BranchTable({ group }: { group: BranchAccounts }) {
  const { t } = useTranslation();
  // كل صف يحمل عملته، والمجموعة تُستعمل عند غيابها فقط.
  const money = (amount: number, currency: string) => formatMoney(amount, currency || group.currency);

  // الجدول يُظهر الأهم أولاً: السائق، والمال الذي معه، والمسلَّم. الباقي يظهر مع اتساع الشاشة.
  const columns: RecordColumn<DriverRow>[] = [
    {
      key: "driver",
      header: t("drivers.accounts.driver"),
      cell: (row) => <span className="font-medium text-ink">{row.driverName}</span>,
    },
    {
      key: "cashToHandIn",
      header: t("drivers.accounts.cashToHandIn"),
      align: "end",
      cell: (row) => <span className="font-semibold tabular-nums text-ink">{money(row.cashToHandIn, row.currency)}</span>,
    },
    {
      key: "cashInTransit",
      header: t("drivers.accounts.cashInTransit"),
      align: "end",
      from: "lg",
      cell: (row) => <span className="tabular-nums text-ink-soft">{money(row.cashInTransit, row.currency)}</span>,
    },
    {
      key: "failedCash",
      header: t("drivers.accounts.failedCash"),
      align: "end",
      from: "lg",
      cell: (row) => <span className="tabular-nums text-ink-soft">{money(row.failedCash, row.currency)}</span>,
    },
    {
      key: "failedCardOrders",
      header: t("drivers.accounts.failedCardOrders"),
      align: "end",
      from: "xl",
      cell: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.failedCardOrders)}</span>,
    },
    {
      key: "delivered",
      header: t("drivers.accounts.delivered"),
      align: "end",
      cell: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.delivered)}</span>,
    },
    {
      key: "failed",
      header: t("drivers.accounts.failed"),
      align: "end",
      from: "lg",
      cell: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.failed)}</span>,
    },
    {
      key: "outNow",
      header: t("drivers.accounts.outNow"),
      align: "end",
      from: "xl",
      cell: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.outNow)}</span>,
    },
    {
      key: "assigned",
      header: t("drivers.accounts.assigned"),
      align: "end",
      from: "lg",
      cell: (row) => <span className="tabular-nums text-ink-soft">{formatNumber(row.assigned)}</span>,
    },
  ];

  // الكرت يحمل المال الذي مع السائق في أعلاه، والباقي في شبكة صغيرة.
  const renderCard = (row: DriverRow) => {
    const stats: [string, ReactNode][] = [
      [t("drivers.accounts.cashInTransit"), money(row.cashInTransit, row.currency)],
      [t("drivers.accounts.failedCash"), money(row.failedCash, row.currency)],
      [t("drivers.accounts.failedCardOrders"), formatNumber(row.failedCardOrders)],
      [t("drivers.accounts.delivered"), formatNumber(row.delivered)],
      [t("drivers.accounts.failed"), formatNumber(row.failed)],
      [t("drivers.accounts.outNow"), formatNumber(row.outNow)],
      [t("drivers.accounts.assigned"), formatNumber(row.assigned)],
    ];

    return (
      <article className="space-y-3 rounded-2xl border border-line bg-canvas/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate font-semibold text-ink">{row.driverName}</p>
          <div className="shrink-0 text-end">
            <p className="text-xs text-muted">{t("drivers.accounts.cashToHandIn")}</p>
            <p className="font-bold tabular-nums text-ink">{money(row.cashToHandIn, row.currency)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-sm">
          {stats.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-0.5 tabular-nums text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    );
  };

  return (
    <Panel
      title={group.branchName}
      description={t("drivers.accounts.count", { count: formatNumber(group.drivers.length) })}
    >
      {group.drivers.length === 0 ? (
        <EmptyState>{t("drivers.assign.noDrivers")}</EmptyState>
      ) : (
        // الهامش السالب يُخرج الجدول إلى حواف البطاقة، كما في بقية الجداول.
        <div className="-mx-4 -mb-4 overflow-hidden sm:-mx-5 sm:-mb-5">
          <ResponsiveRecordList
            label={group.branchName}
            rows={group.drivers}
            getKey={(row, index) => `${row.driverId}-${index}`}
            columns={columns}
            renderCard={renderCard}
          />
        </div>
      )}
    </Panel>
  );
}

function Definition({ term, text }: { term: string; text: string }) {
  return (
    <div>
      <dt className="font-semibold text-ink">{term}</dt>
      <dd className="mt-1 text-ink-soft">{text}</dd>
    </div>
  );
}
