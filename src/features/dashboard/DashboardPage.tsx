import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { CalendarDays, Store } from "lucide-react";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/States";
import { currentLanguage } from "@/i18n";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
import { useSession } from "@/features/auth/session-store";
import { localizedName, localizedRecord } from "@/lib/localized";
import { formatDateTime } from "@/lib/format";
import { useBranchOptions, useCustomers, useOperations, useOverview, useProducts } from "./queries";
import { OverviewTab } from "./tabs/OverviewTab";
import { OperationsTab } from "./tabs/OperationsTab";
import { ProductsTab } from "./tabs/ProductsTab";
import { CustomersTab } from "./tabs/CustomersTab";
import type { DashboardFilters, DashboardTab, Period, PeriodChoice } from "./types";

const PERIODS: Period[] = ["today", "yesterday", "7d", "30d", "90d", "all"];

/** صلاحية كل تبويب، كما في لوحة التحكم القديمة. نظرة عامة تحرسها الشاشة كلها. */
const TAB_PERMISSION: Record<Exclude<DashboardTab, "overview">, string> = {
  operations: "admin.dashboard.operations",
  products: "admin.dashboard.products",
  customers: "admin.dashboard.customers",
};

/** صلاحية قراءة الفروع، وبها تُعبّأ قائمة اختيار الفرع في الفلاتر. */
const BRANCHES_PERMISSION = "branches.index";

// على الهاتف حقل بعرض كامل وارتفاع 44px، وعلى الشاشات الواسعة الحجم الأصلي.
const FIELD =
  "h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none transition focus:border-primary sm:h-9 sm:w-auto";

export function DashboardPage() {
  const { t } = useTranslation();
  const language = currentLanguage();
  const user = useSession((state) => state.user);
  const scope = useBranchScope();
  const permissions = usePermissions();

  const [tab, setTab] = useState<DashboardTab>("overview");
  const [choice, setChoice] = useState<PeriodChoice>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  // التبويب الممنوع لا يُفتح ولا يُجلب، ويقع الاختيار على نظرة عامة.
  const canTab = (value: DashboardTab) => value === "overview" || permissions.has(TAB_PERMISSION[value]);
  const activeTab = canTab(tab) ? tab : "overview";
  const canListBranches = permissions.has(BRANCHES_PERMISSION);

  const isCustom = choice === "custom";
  const customReady = customFrom !== "" && customTo !== "";
  const ready = !isCustom || customReady;

  const filters: DashboardFilters = {
    period: isCustom ? "all" : choice,
    from: isCustom && customReady ? customFrom : null,
    to: isCustom && customReady ? customTo : null,
    // الحساب المقصور يرى فرعه وحده، حتى لو أرسلت الواجهة غير ذلك.
    branchId: scope.isBranchScoped ? scope.branchId : selectedBranch,
  };

  const overview = useOverview(filters, ready);
  const operations = useOperations(filters, ready && activeTab === "operations");
  const products = useProducts(filters, ready && activeTab === "products");
  const customers = useCustomers(filters, ready && activeTab === "customers");

  const branchOptions = useBranchOptions(!scope.isBranchScoped && canListBranches);
  const branchName = scope.isBranchScoped ? localizedName(user?.branch, language) : "";

  const periodOptions: SegmentOption<PeriodChoice>[] = [
    ...PERIODS.map((period) => ({ value: period, label: t(`dashboard.periods.${period}`) })),
    { value: "custom", label: t("dashboard.periods.custom") },
  ];

  const tabOptions: SegmentOption<DashboardTab>[] = [
    { value: "overview", label: t("dashboard.tabs.overview") },
    { value: "operations", label: t("dashboard.tabs.operations") },
    { value: "products", label: t("dashboard.tabs.products") },
    { value: "customers", label: t("dashboard.tabs.customers") },
  ];

  const generatedAt = overview.data?.generatedAt ?? null;

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{t("dashboard.title")}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{branchName ? t("dashboard.subtitleBranch", { branch: branchName }) : t("dashboard.subtitle")}</span>
          {generatedAt && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-ok" />
              {t("dashboard.updatedAt", { time: formatDateTime(generatedAt) })}
            </span>
          )}
        </p>
      </header>

      {/* شريط الفلاتر: الفترة والفرع والتاريخ المخصص في بطاقة واحدة. على الهاتف تُكدَّس عناصره. */}
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[0_1px_0_rgba(23,25,31,0.04)] sm:flex sm:flex-wrap sm:items-center">
        {/* على الهاتف قائمة واحدة للفترة، وعلى الشاشات الواسعة الأزرار الظاهرة كما كانت. */}
        <div className="hidden sm:block">
          <Segmented label={t("dashboard.periodLabel")} value={choice} options={periodOptions} onChange={setChoice} />
        </div>
        <Select
          wrapperClassName="w-full sm:hidden"
          className="w-full"
          aria-label={t("dashboard.periodLabel")}
          value={choice}
          onChange={(event) => setChoice(event.target.value as PeriodChoice)}
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {!scope.isBranchScoped && canListBranches && (
          <Select
            icon={Store}
            wrapperClassName="w-full sm:w-auto"
            className="w-full sm:w-auto"
            aria-label={t("dashboard.branchLabel")}
            value={selectedBranch ?? ""}
            onChange={(event) => setSelectedBranch(event.target.value === "" ? null : Number(event.target.value))}
            disabled={branchOptions.isPending}
          >
            <option value="">{t("dashboard.allBranches")}</option>
            {(branchOptions.data?.items ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {localizedRecord(branch, language)}
              </option>
            ))}
          </Select>
        )}

        {isCustom && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:ms-auto sm:flex sm:flex-wrap sm:items-center">
            <label className="relative flex flex-col gap-1 text-ink-soft sm:flex-row sm:items-center sm:gap-2">
              <CalendarDays className="pointer-events-none hidden size-4 text-muted sm:block" aria-hidden />
              {t("dashboard.from")}
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1 text-ink-soft sm:flex-row sm:items-center sm:gap-2">
              {t("dashboard.to")}
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) => setCustomTo(event.target.value)}
                className={FIELD}
              />
            </label>
          </div>
        )}
      </div>

      <nav role="tablist" aria-label={t("dashboard.tabsLabel")} className="no-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
        {tabOptions
          .filter((option) => canTab(option.value))
          .map((option) => {
            const active = option.value === activeTab;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(option.value)}
                className={clsx(
                  // على الهاتف ارتفاع اللمس 44px، وعلى الشاشات الواسعة الحجم الأصلي.
                  "-mb-px cursor-pointer whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition sm:pb-3 sm:pt-1",
                  active ? "border-primary text-ink" : "border-transparent text-muted hover:border-line hover:text-ink"
                )}
              >
                {option.label}
              </button>
            );
          })}
      </nav>

      {/* المفتاح بالتبويب يعيد تشغيل حركة الظهور عند كل تبديل. */}
      <div key={activeTab} className="animate-page-in">
        {!ready && <EmptyState>{t("dashboard.pickRange")}</EmptyState>}
        {ready && activeTab === "overview" && <OverviewTab query={overview} />}
        {ready && activeTab === "operations" && <OperationsTab query={operations} />}
        {ready && activeTab === "products" && <ProductsTab query={products} />}
        {ready && activeTab === "customers" && <CustomersTab query={customers} />}
      </div>
    </div>
  );
}
