import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, BellOff, Eye } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { SelectField } from "@/components/ui/Fields";
import { RemoteSelect } from "@/components/ui/RemoteSelect";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { FilterSheet, type ActiveFilter } from "@/components/ui/FilterSheet";
import { ResponsiveRecordList, type RecordColumn } from "@/components/ui/ResponsiveRecordList";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
import { ADMIN_DRIVER_PERMISSIONS } from "@/features/drivers/permissions";
import { driverFilterSource } from "@/features/drivers/driverSource";
import { currentLanguage } from "@/i18n";
import { toNumber, toText } from "@/lib/coerce";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { remoteSource } from "@/modules/shared";
import { branches, listAll, orderAdmin, type Named } from "@/services";
import { OrderInvoice } from "./OrderInvoice";
import { StatusPicker } from "./StatusPicker";
import { ORDER_STATUSES } from "./orderStatus";
import { AssignDriverDialog } from "./AssignDriverDialog";
import { useNewOrderAlert } from "./newOrderAlert";
import { OrderCard } from "./OrderCard";
import { AwaitingBadge, DriverCell, RatingStars, StatusTrigger, TypeChip } from "./OrderRowParts";
import { branchOf, customerOf, refOf, typeOf, type OrderType } from "./orderRows";
import { isAwaitingAcceptance } from "./acceptance";

// الفروع تُبحث في الخادم عشرين في الصفحة، كما في قائمة الفرع عند إنشاء الطلب.
const BRANCH_FILTER = remoteSource("branches", branches);

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

/**
 * صفحة الطلبات: فلاتر الحالة والنوع والفرع والتاريخ والتقييم، ونوع الطلب في الجدول،
 * وتغيير الحالة من نافذة واضحة تعرض مراحل الطلب والخطوات المسموحة فقط.
 *
 * على الهاتف تصير الصفوف كروتاً، والفلاتر زراً يفتح نافذة سفلية. الجدول والكروت يعرضان البيانات
 * نفسها بالإجراءات نفسها، وتظهر الأعمدة الثانوية في الجدول كلما اتسعت الشاشة.
 */
export function OrdersPage() {
  const { t } = useTranslation();
  const language = currentLanguage();
  const permissions = usePermissions();
  const scope = useBranchScope();

  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | OrderType>("");
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const [branchLabel, setBranchLabel] = useState("");
  const [date, setDate] = useState("");
  const [maxRating, setMaxRating] = useState("");
  // قيمة واحدة لفلتر السائق: "needs" للطلبات بلا سائق، أو معرّف سائق بعينه، أو فارغ للكل.
  const [driverChoice, setDriverChoice] = useState("");
  // اسم السائق المختار يُحفظ مع القيمة، فلا يُطلب من الخادم مجدداً عند كل عرض.
  const [driverLabel, setDriverLabel] = useState("");
  const driverFilter = useMemo(() => driverFilterSource(t), [t]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [viewing, setViewing] = useState<Named | null>(null);
  const [picking, setPicking] = useState<Named | null>(null);
  const [assigning, setAssigning] = useState<Named | null>(null);

  const canList = permissions.has("admin.orders.index");
  const canView = permissions.has("admin.orders.show");
  const canChangeStatus = permissions.has("admin.orders.status.update");
  const canAssign = permissions.has(ADMIN_DRIVER_PERMISSIONS.assign);
  // تنبيه الطلبات الجديدة: الاستعلام الدوري يعمل مع الصفحة، والصوت اختياري.
  // "عرض الأحدث" في التنبيه يعيد القائمة إلى الصفحة الأولى، حيث تظهر الطلبات الجديدة.
  // الصوت يرن للطلبات المنتظرة للقبول لمن يستطيع قبولها (تغيير الحالة) فقط.
  const alert = useNewOrderAlert(canList, () => setPage(1), canChangeStatus);
  // المستخدم المرتبط بفرع يرى فرعه فقط، والخادم يفرض ذلك أيضاً.
  const branchId = scope.isBranchScoped ? scope.branchId : branchFilter;

  // الفلاتر التي يفهمها الخادم. فلتر النوع ليس منها، فيُطبَّق محلياً.
  const serverFilters = {
    status: status || undefined,
    branch_id: branchId ?? undefined,
    date: date || undefined,
    max_rating: maxRating || undefined,
    needs_driver: driverChoice === "needs" ? 1 : undefined,
    driver_id: /^\d+$/.test(driverChoice) ? Number(driverChoice) : undefined,
  };
  const typed = typeFilter !== "";

  // بلا فلتر النوع: الترقيم من الخادم مباشرة.
  const pageQuery = useQuery({
    queryKey: ["orders", "admin", "page", serverFilters, page, perPage],
    enabled: canList && !typed,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      // الخادم يقرأ عدد الصفوف من `perPage` بهذا الاسم، و`per_page` يتجاهله.
      const result = await orderAdmin.list({ ...serverFilters, page, perPage }, signal);
      // الصفحة الحالية هي ما طلبناه، فلا يعتمد الترقيم على حقل قد يغيب من الاستجابة.
      return { items: result.items, meta: { ...result.meta, currentPage: page } };
    },
  });

  // مع فلتر النوع: تُجلب الطلبات المطابقة للفلاتر الخادمية مرة واحدة، ثم يُفلتر النوع ويُقسَّم محلياً.
  // تغيير الصفحة أو عدد الصفوف لا يعيد الجلب؛ ما يعيده هو تغيير الفلاتر الخادمية أو تحديث الحالة.
  const allQuery = useQuery({
    queryKey: ["orders", "admin", "all", serverFilters],
    enabled: canList && typed,
    staleTime: 30_000,
    queryFn: ({ signal }) =>
      listAll(
        (query, pageSignal) => orderAdmin.list({ ...serverFilters, page: query.page, perPage: 100 }, pageSignal),
        signal
      ),
  });

  const typedRows = typed ? (allQuery.data ?? []).filter((row) => typeOf(row) === typeFilter) : [];
  const typedLast = Math.max(1, Math.ceil(typedRows.length / perPage));
  const typedPage = Math.min(page, typedLast);

  const rows = typed ? typedRows.slice((typedPage - 1) * perPage, typedPage * perPage) : (pageQuery.data?.items ?? []);
  const meta = typed
    ? { total: typedRows.length, currentPage: typedPage, lastPage: typedLast, perPage }
    : pageQuery.data?.meta;
  const loading = typed ? allQuery.isPending : pageQuery.isPending;
  const failed = typed ? allQuery.isError : pageQuery.isError;
  const retry = () => void (typed ? allQuery.refetch() : pageQuery.refetch());

  const resetFilters = () => {
    setStatus("");
    setTypeFilter("");
    setBranchFilter(null);
    setBranchLabel("");
    setDate("");
    setMaxRating("");
    setDriverChoice("");
    setDriverLabel("");
    setPage(1);
  };

  // الفلاتر النشطة: تظهر على الهاتف شارات قابلة للإزالة. فرع الحساب المقصور لا يُعد فلتراً، لأنه ثابت.
  const activeFilters: ActiveFilter[] = [];
  if (status) {
    activeFilters.push({
      key: "status",
      label: t(`orders.status.${status}`),
      onRemove: () => {
        setStatus("");
        setPage(1);
      },
    });
  }
  if (typeFilter) {
    activeFilters.push({
      key: "type",
      label: typeFilter === "delivery" ? t("orderInvoice.delivery") : t("orderInvoice.pickup"),
      onRemove: () => {
        setTypeFilter("");
        setPage(1);
      },
    });
  }
  if (!scope.isBranchScoped && branchFilter !== null) {
    activeFilters.push({
      key: "branch",
      label: branchLabel || String(branchFilter),
      onRemove: () => {
        setBranchFilter(null);
        setBranchLabel("");
        setPage(1);
      },
    });
  }
  if (driverChoice) {
    activeFilters.push({
      key: "driver",
      label: driverChoice === "needs" ? t("drivers.assign.needsDriver") : driverLabel || driverChoice,
      onRemove: () => {
        setDriverChoice("");
        setDriverLabel("");
        setPage(1);
      },
    });
  }
  if (date) {
    activeFilters.push({
      key: "date",
      label: date,
      onRemove: () => {
        setDate("");
        setPage(1);
      },
    });
  }
  if (maxRating) {
    activeFilters.push({
      key: "rating",
      label: t("ordersPage.stars", { n: maxRating }),
      onRemove: () => {
        setMaxRating("");
        setPage(1);
      },
    });
  }

  // أعمدة الجدول. الثانوية منها تظهر عند اتساع الشاشة، والإجراءات تبقى دائماً.
  const columns: RecordColumn<Named>[] = [
    {
      key: "number",
      header: t("orders.table.number"),
      cell: (row) => (
        <div className="space-y-1.5">
          {canView ? (
            <button
              type="button"
              onClick={() => setViewing(row)}
              className="cursor-pointer font-mono font-semibold text-ink hover:text-secondary"
            >
              {refOf(row)}
            </button>
          ) : (
            <span className="font-mono font-semibold text-ink">{refOf(row)}</span>
          )}
          {isAwaitingAcceptance(toText(row.status)) && <AwaitingBadge />}
        </div>
      ),
    },
    {
      key: "created",
      header: t("orders.table.created"),
      from: "xl",
      cell: (row) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted">
          {formatDateTime(toText(row.created_at) || null)}
        </span>
      ),
    },
    {
      key: "customer",
      header: t("orders.table.customer"),
      cell: (row) => {
        const customer = customerOf(row);
        return (
          <>
            <p className="max-w-48 truncate font-medium text-ink">{customer.name}</p>
            {customer.phone && (
              <p dir="ltr" className="text-xs tabular-nums text-muted">
                {customer.phone}
              </p>
            )}
          </>
        );
      },
    },
    {
      key: "type",
      header: t("ordersPage.colType"),
      from: "lg",
      cell: (row) => <TypeChip type={typeOf(row)} />,
    },
    {
      key: "driver",
      header: t("ordersPage.colDriver"),
      from: "lg",
      cell: (row) => <DriverCell row={row} canAssign={canAssign} onAssign={() => setAssigning(row)} />,
    },
    {
      key: "branch",
      header: t("ordersPage.colBranch"),
      from: "xl",
      cell: (row) => <span className="block max-w-40 truncate text-ink-soft">{branchOf(row, language)}</span>,
    },
    {
      key: "total",
      header: t("orders.table.total"),
      align: "end",
      cell: (row) => (
        <span className="font-semibold tabular-nums text-ink">
          {formatMoney(toNumber(row.final_price), toText(row.currency))}
        </span>
      ),
    },
    {
      key: "rating",
      header: t("ordersPage.colRating"),
      from: "xl",
      cell: (row) => <RatingStars row={row} />,
    },
    {
      key: "status",
      header: t("orders.table.status"),
      cell: (row) => (
        <StatusTrigger row={row} canChange={canChangeStatus} onOpen={() => setPicking(row)} />
      ),
    },
    {
      key: "actions",
      header: null,
      align: "end",
      cell: (row) =>
        canView && (
          <button
            type="button"
            onClick={() => setViewing(row)}
            aria-label={t("ordersPage.view")}
            title={t("ordersPage.view")}
            className="grid size-11 cursor-pointer place-items-center rounded-xl text-ink-soft ring-1 ring-line transition hover:ring-primary xl:size-8 xl:rounded-lg"
          >
            <Eye className="size-4" aria-hidden />
          </button>
        ),
    },
  ];

  // حقول الفلاتر. تُعرض في الشريط على الشاشات الواسعة، وفي النافذة السفلية على الهاتف.
  const filterFields = (
    <>
      <SelectField
        label={t("ordersPage.statusFilter")}
        options={ORDER_STATUSES.map((value) => ({ value, label: t(`orders.status.${value}`) }))}
        value={status || null}
        placeholder={t("ordersPage.allStatuses")}
        onChange={(value) => {
          setStatus(value === null ? "" : String(value));
          setPage(1);
        }}
      />
      <SelectField
        label={t("ordersPage.typeFilter")}
        options={[
          { value: "delivery", label: t("orderInvoice.delivery") },
          { value: "pickup", label: t("orderInvoice.pickup") },
        ]}
        value={typeFilter || null}
        placeholder={t("ordersPage.allTypes")}
        onChange={(value) => {
          setTypeFilter(value === null ? "" : (String(value) as OrderType));
          setPage(1);
        }}
      />
      <RemoteSelect
        label={t("ordersPage.branchFilter")}
        source={BRANCH_FILTER}
        value={branchId}
        fallbackLabel={branchLabel || undefined}
        disabled={scope.isBranchScoped}
        placeholder={t("ordersPage.allBranches")}
        onChange={(value, label) => {
          setBranchFilter(value === null ? null : Number(value));
          setBranchLabel(label);
          setPage(1);
        }}
      />
      <RemoteSelect
        label={t("ordersPage.driverFilter")}
        source={driverFilter}
        value={driverChoice || null}
        fallbackLabel={driverLabel || undefined}
        placeholder={t("ordersPage.allDrivers")}
        onChange={(value, label) => {
          setDriverChoice(value === null ? "" : String(value));
          setDriverLabel(label);
          setPage(1);
        }}
      />
      <Input
        label={t("ordersPage.dateFilter")}
        type="date"
        value={date}
        onChange={(event) => {
          setDate(event.target.value);
          setPage(1);
        }}
      />
      <SelectField
        label={t("ordersPage.ratingFilter")}
        options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: t("ordersPage.stars", { n: value }) }))}
        value={maxRating || null}
        placeholder={t("ordersPage.allRatings")}
        onChange={(value) => {
          setMaxRating(value === null ? "" : String(value));
          setPage(1);
        }}
      />
    </>
  );

  if (!canList) return <EmptyState>{t("ordersPage.noAccess")}</EmptyState>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">{t("nav.orders")}</h2>
          {meta && <p className="text-sm tabular-nums text-muted">{t("ordersPage.count", { count: formatNumber(meta.total) })}</p>}
        </div>
        <button
          type="button"
          onClick={alert.toggleSound}
          aria-pressed={alert.soundOn}
          aria-label={alert.soundOn ? t("ordersPage.soundOff") : t("ordersPage.soundOn")}
          title={t("ordersPage.soundHint")}
          className="inline-flex size-11 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium ring-1 ring-line transition hover:ring-primary sm:h-10 sm:w-auto sm:px-4"
        >
          {alert.soundOn ? (
            <Bell className="size-4 text-secondary" aria-hidden />
          ) : (
            <BellOff className="size-4 text-muted" aria-hidden />
          )}
          <span className="hidden sm:inline">{alert.soundOn ? t("ordersPage.soundOff") : t("ordersPage.soundOn")}</span>
        </button>
      </header>

      <FilterSheet activeFilters={activeFilters} onReset={resetFilters}>
        {filterFields}
      </FilterSheet>

      <section className="rounded-2xl border border-line bg-surface">
        {loading ? (
          <Skeleton className="m-4 h-64" />
        ) : failed ? (
          <div className="p-4">
            <ErrorState message={t("errors.unexpected")} onRetry={retry} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState>{t("ordersPage.empty")}</EmptyState>
        ) : (
          <ResponsiveRecordList
            label={t("nav.orders")}
            rows={rows}
            getKey={(row) => String(row.id)}
            columns={columns}
            renderCard={(row) => (
              <OrderCard
                row={row}
                canView={canView}
                canAssign={canAssign}
                canChangeStatus={canChangeStatus}
                awaiting={isAwaitingAcceptance(toText(row.status))}
                onView={() => setViewing(row)}
                onAssign={() => setAssigning(row)}
                onChangeStatus={() => setPicking(row)}
              />
            )}
          />
        )}

        {meta && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
            <label className="flex items-center gap-2 text-sm text-muted">
              {t("ordersPage.rowsPerPage")}
              <Select
                value={perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value));
                  setPage(1);
                }}
              >
                {PER_PAGE_OPTIONS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </Select>
            </label>
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </section>

      {picking && <StatusPicker row={picking} onClose={() => setPicking(null)} />}

      {assigning && <AssignDriverDialog row={assigning} onClose={() => setAssigning(null)} />}

      {viewing && (
        <Dialog open onClose={() => setViewing(null)} size="lg" title={t("orderInvoice.title")}>
          <OrderInvoice record={viewing} />
        </Dialog>
      )}
    </div>
  );
}
