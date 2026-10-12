import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bell, BellOff, ChevronDown, Eye, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { SelectField } from "@/components/ui/Fields";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
import { ADMIN_DRIVER_PERMISSIONS } from "@/features/drivers/permissions";
import { useDriverOptions } from "@/features/drivers/useDriverOptions";
import { currentLanguage } from "@/i18n";
import { asRecord, toNumber, toText } from "@/lib/coerce";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { localizedRecord } from "@/lib/localized";
import { branches, listAll, orderAdmin, type Named } from "@/services";
import { OrderInvoice } from "./OrderInvoice";
import { StatusPicker } from "./StatusPicker";
import { statusDotClass } from "./statusTone";
import { ORDER_STATUSES, isFinalOrder, serverLabelOf } from "./orderStatus";
import { AssignDriverDialog } from "./AssignDriverDialog";
import { canAssignDriver } from "./driverAssignment";
import { useNewOrderAlert } from "./newOrderAlert";

type OrderType = "delivery" | "pickup";

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

/** نوع الطلب كما يعرفه الخادم: توصيل، أو استلام من الفرع (ومنه طلبات نقطة البيع). */
const typeOf = (row: Named): OrderType => (toText(row.delivery_type) === "delivery" ? "delivery" : "pickup");

const refOf = (row: Named) => toText(row.order_number) || `#${String(row.id)}`;

const customerOf = (row: Named) => {
  const customer = asRecord(row.customer);
  return {
    name: toText(customer.name) || toText(row.customer_name) || "—",
    phone: toText(customer.phone),
  };
};

/**
 * صفحة الطلبات: فلاتر الحالة والنوع والفرع والتاريخ والتقييم، ونوع الطلب في الجدول،
 * وتغيير الحالة من نافذة واضحة تعرض مراحل الطلب والخطوات المسموحة فقط.
 */
export function OrdersPage() {
  const { t } = useTranslation();
  const language = currentLanguage();
  const permissions = usePermissions();
  const scope = useBranchScope();

  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | OrderType>("");
  const [branchFilter, setBranchFilter] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [maxRating, setMaxRating] = useState("");
  // قيمة واحدة لفلتر السائق: "needs" للطلبات بلا سائق، أو معرّف سائق بعينه، أو فارغ للكل.
  const [driverChoice, setDriverChoice] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [viewing, setViewing] = useState<Named | null>(null);
  const [picking, setPicking] = useState<Named | null>(null);
  const [assigning, setAssigning] = useState<Named | null>(null);

  const canList = permissions.has("admin.orders.index");
  const canView = permissions.has("admin.orders.show");
  const canChangeStatus = permissions.has("admin.orders.status.update");
  const canAssign = permissions.has(ADMIN_DRIVER_PERMISSIONS.assign);
  const drivers = useDriverOptions(canList);
  // تنبيه الطلبات الجديدة: الاستعلام الدوري يعمل مع الصفحة، والصوت اختياري.
  const alert = useNewOrderAlert(canList);
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

  const branchList = useQuery({
    queryKey: ["orders-page", "branches"],
    queryFn: async ({ signal }) => (await branches.list({ page: 1, per_page: 500 }, signal)).items,
    enabled: canList && !scope.isBranchScoped,
    staleTime: 5 * 60_000,
  });

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
    setDate("");
    setMaxRating("");
    setDriverChoice("");
    setPage(1);
  };

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
          title={t("ordersPage.soundHint")}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium ring-1 ring-line transition hover:ring-primary"
        >
          {alert.soundOn ? (
            <Bell className="size-4 text-secondary" aria-hidden />
          ) : (
            <BellOff className="size-4 text-muted" aria-hidden />
          )}
          {alert.soundOn ? t("ordersPage.soundOff") : t("ordersPage.soundOn")}
        </button>
      </header>

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 xl:grid-cols-7">
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
        <SelectField
          label={t("ordersPage.branchFilter")}
          options={(branchList.data ?? []).map((row) => ({ value: toNumber(row.id), label: localizedRecord(row, language) || `#${row.id}` }))}
          value={branchId}
          disabled={scope.isBranchScoped}
          placeholder={t("ordersPage.allBranches")}
          onChange={(value) => {
            setBranchFilter(value === null ? null : Number(value));
            setPage(1);
          }}
        />
        <SelectField
          label={t("ordersPage.driverFilter")}
          options={[
            { value: "needs", label: t("drivers.assign.needsDriver") },
            ...(drivers.data ?? []).map((driver) => ({ value: driver.id, label: driver.name })),
          ]}
          value={driverChoice || null}
          placeholder={t("ordersPage.allDrivers")}
          onChange={(value) => {
            setDriverChoice(value === null ? "" : String(value));
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
        <Button variant="ghost" onClick={resetFilters} className="self-end">
          <RotateCcw className="size-4" aria-hidden />
          {t("ordersPage.resetFilters")}
        </Button>
      </section>

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
          <div className="overflow-x-auto rounded-t-2xl">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-secondary text-xs font-semibold text-surface">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{t("orders.table.number")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("orders.table.created")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("orders.table.customer")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("ordersPage.colType")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("ordersPage.colDriver")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("ordersPage.colBranch")}</th>
                  <th className="px-4 py-3 text-end font-medium">{t("orders.table.total")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("ordersPage.colRating")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("orders.table.status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const customer = customerOf(row);
                  return (
                    <tr key={String(row.id)} className="align-middle hover:bg-canvas/60">
                      <td className="px-4 py-3">
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
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted">
                        {formatDateTime(toText(row.created_at) || null)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{customer.name}</p>
                        {customer.phone && <p dir="ltr" className="text-xs tabular-nums text-muted">{customer.phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <TypeChip type={typeOf(row)} />
                      </td>
                      <td className="px-4 py-3">
                        <DriverCell row={row} canAssign={canAssign} onAssign={() => setAssigning(row)} />
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {typeof row.branch === "string"
                          ? row.branch
                          : localizedRecord(asRecord(row.branch), language) || localizedRecord(asRecord(row.menu), language) || "—"}
                      </td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums text-ink">
                        {formatMoney(toNumber(row.final_price), toText(row.currency))}
                      </td>
                      <td className="px-4 py-3">
                        <RatingStars row={row} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusTrigger row={row} canChange={canChangeStatus} onOpen={() => setPicking(row)} />
                      </td>
                      <td className="px-4 py-3 text-end">
                        {canView && (
                          <button
                            type="button"
                            onClick={() => setViewing(row)}
                            aria-label={t("ordersPage.view")}
                            title={t("ordersPage.view")}
                            className="grid size-8 cursor-pointer place-items-center rounded-lg text-ink-soft ring-1 ring-line transition hover:ring-primary"
                          >
                            <Eye className="size-4" aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
        <Dialog open onClose={() => setViewing(null)} size="lg" title={refOf(viewing)}>
          <OrderInvoice record={viewing} />
        </Dialog>
      )}
    </div>
  );
}

/** زر الحالة في الجدول: نقطة اللون والتسمية الرسمية، ويفتح نافذة التغيير بنقرة واحدة. */
function StatusTrigger({ row, canChange, onOpen }: { row: Named; canChange: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const current = toText(row.status);
  const final = isFinalOrder(row);
  const locked = !canChange || final;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onOpen}
      title={final ? t("ordersPage.finalLocked") : t("ordersPage.changeStatus")}
      className="inline-flex max-w-full cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-70"
    >
      <span className={`size-2.5 shrink-0 rounded-full ${statusDotClass(current)}`} aria-hidden />
      <span className="truncate">{serverLabelOf(row, current, language) ?? t(`orders.status.${current}`, { defaultValue: current })}</span>
      {final ? (
        <Lock className="size-3.5 shrink-0 text-muted" aria-hidden />
      ) : (
        canChange && <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />
      )}
    </button>
  );
}

/**
 * عمود السائق: اسم السائق، أو تنبيه «بانتظار سائق» لتوصيل بلا سائق. زر الإسناد يظهر
 * لمن يملك صلاحيته، وللطلب الذي ما زال قبل الاستلام من الفرع.
 */
function DriverCell({ row, canAssign, onAssign }: { row: Named; canAssign: boolean; onAssign: () => void }) {
  const { t } = useTranslation();
  if (toText(row.delivery_type) !== "delivery") return <span className="text-muted">—</span>;

  const name = toText(asRecord(row.driver).name);
  const editable = canAssign && canAssignDriver(row);

  return (
    <div className="space-y-1">
      {name ? (
        <p className="font-medium text-ink">{name}</p>
      ) : (
        <Badge tone="warn">{t("drivers.assign.needsDriver")}</Badge>
      )}
      {editable && (
        <button
          type="button"
          onClick={onAssign}
          className="cursor-pointer text-xs font-medium text-secondary hover:underline"
        >
          {name ? t("drivers.assign.change") : t("drivers.assign.assign")}
        </button>
      )}
    </div>
  );
}

function TypeChip({ type }: { type: OrderType }) {
  const { t } = useTranslation();
  const tone = type === "delivery" ? "bg-primary text-ink" : "bg-secondary-soft text-secondary";
  const label = type === "delivery" ? t("orderInvoice.delivery") : t("orderInvoice.pickup");
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function RatingStars({ row }: { row: Named }) {
  const rating = Math.round(toNumber(row.rating));
  if (rating <= 0) return <span className="text-muted">—</span>;
  return (
    <span className="whitespace-nowrap text-warn" title={toText(row.rating_note) || undefined}>
      {"★".repeat(rating)}
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
