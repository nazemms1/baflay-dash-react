import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
import { Input } from "@/components/ui/Input";
import { SelectField } from "@/components/ui/Fields";
import { Panel } from "@/components/ui/Panel";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { currentLanguage } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { localizedRecord } from "@/lib/localized";
import { branches, orderAdmin } from "@/services";
import { ADMIN_DRIVER_PERMISSIONS } from "./permissions";
import { toBranchAccounts, todayIso, type BranchAccounts } from "./driverReport";

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

  return (
    <Panel
      title={group.branchName}
      description={t("drivers.accounts.count", { count: formatNumber(group.drivers.length) })}
    >
      {group.drivers.length === 0 ? (
        <EmptyState>{t("drivers.assign.noDrivers")}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("drivers.accounts.driver")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.cashToHandIn")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.cashInTransit")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.failedCash")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.failedCardOrders")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.delivered")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.failed")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.outNow")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("drivers.accounts.assigned")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {group.drivers.map((row, index) => (
                <tr key={`${row.driverId}-${index}`} className="align-middle">
                  <td className="px-3 py-2.5 font-medium text-ink">{row.driverName}</td>
                  <td className="px-3 py-2.5 text-end font-semibold tabular-nums text-ink">{money(row.cashToHandIn, row.currency)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-ink-soft">{money(row.cashInTransit, row.currency)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-ink-soft">{money(row.failedCash, row.currency)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-ink-soft">{formatNumber(row.failedCardOrders)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-ink-soft">{formatNumber(row.delivered)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-ink-soft">{formatNumber(row.failed)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-ink-soft">{formatNumber(row.outNow)}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-ink-soft">{formatNumber(row.assigned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
