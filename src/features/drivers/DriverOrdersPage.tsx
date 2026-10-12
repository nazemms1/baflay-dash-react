import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bike, Inbox, RefreshCw, Search } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Segmented, type SegmentOption } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Bars";
import { usePermissions } from "@/features/auth/hooks";
import { nextStatusesOf } from "@/features/orders/orderStatus";
import { toNumber, toText } from "@/lib/coerce";
import { formatDay } from "@/lib/format";
import { driverOrders, type Named } from "@/services";
import { DRIVER_PERMISSIONS } from "./permissions";
import { driverErrorCode, driverErrorMessage, STALE_ORDER_CODES } from "./driverErrors";
import { toDriverSummary, todayIso, type AccountRow } from "./driverReport";
import { DriverOrderCard, type DriverActions } from "./DriverOrderCard";
import { DriverSummary } from "./DriverSummary";
import { DeliveredDialog, FailedDialog, OrderDetailsDialog } from "./DriverDialogs";
import { customerOf, refOf } from "./orderFields";

type DriverTab = "active" | "done" | "failed" | "all";
type DriverAction = "pickup" | "delivered" | "failed";

interface ActionVars {
  order: Named;
  action: DriverAction;
  reason?: string;
  note?: string;
}

/**
 * شاشة السائق: يبدأ بما عليه من مال اليوم، ثم طلباته مرتبة في تبويبات، مع بحث سريع بالرقم أو
 * الاسم أو الهاتف. الخطوة التالية تأتي من الخادم (`next_statuses`)، فالزر لا يظهر إلا إن كان مقبولاً.
 */
export function DriverOrdersPage() {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const today = todayIso();
  const [tab, setTab] = useState<DriverTab>("active");
  const [date, setDate] = useState(today);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [delivering, setDelivering] = useState<Named | null>(null);
  const [failing, setFailing] = useState<Named | null>(null);

  const canList = permissions.has(DRIVER_PERMISSIONS.index);
  const canShow = permissions.has(DRIVER_PERMISSIONS.show);
  const canSummary = permissions.has(DRIVER_PERMISSIONS.summary);
  const canAct = {
    pickup: permissions.has(DRIVER_PERMISSIONS.pickup),
    delivered: permissions.has(DRIVER_PERMISSIONS.delivered),
    failed: permissions.has(DRIVER_PERMISSIONS.failed),
  };

  const list = useQuery({
    queryKey: ["driver-orders", "list", tab, date, page],
    enabled: canList,
    placeholderData: keepPreviousData,
    // الطلب الجاري لا يرتبط باليوم: ما زال معه أو في طريقه فيظهر دائماً، أما المنتهي فيُفلتر باليوم.
    queryFn: ({ signal }) => driverOrders.list({ status: tab, date: tab === "active" ? undefined : date, page }, signal),
  });

  const summary = useQuery<AccountRow[]>({
    queryKey: ["driver-orders", "summary", date],
    enabled: canSummary,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => driverOrders.summary({ date }, signal).then(toDriverSummary),
  });

  const details = useQuery({
    queryKey: ["driver-orders", "detail", detailsId],
    enabled: canShow && detailsId !== null,
    queryFn: ({ signal }) => driverOrders.get(detailsId ?? 0, signal),
  });

  const act = useMutation({
    mutationFn: ({ order, action, reason, note }: ActionVars) => {
      const id = toNumber(order.id);
      if (action === "pickup") return driverOrders.pickup(id);
      if (action === "delivered") return driverOrders.delivered(id);
      return driverOrders.failed(id, { reason: reason ?? "", ...(note ? { note } : {}) });
    },
    onSuccess: async (_result, vars) => {
      toast.success(t(`drivers.done.${vars.action}`));
      setDelivering(null);
      setFailing(null);
      await queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
    },
    onError: async (error) => {
      toast.error(driverErrorMessage(error, t, t("errors.unexpected")));
      if (STALE_ORDER_CODES.includes(driverErrorCode(error) ?? "")) {
        await queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
      }
    },
  });

  if (!canList) return <EmptyState>{t("drivers.noAccess")}</EmptyState>;

  const rows = list.data?.items ?? [];
  const meta = list.data?.meta;
  const busyId = act.isPending && act.variables ? toNumber(act.variables.order.id) : null;
  const detailRow = details.data ?? rows.find((row) => toNumber(row.id) === detailsId) ?? null;
  const query = search.trim().toLowerCase();
  const visible = query ? rows.filter((order) => matchesSearch(order, query)) : rows;

  const tabOptions: SegmentOption<DriverTab>[] = [
    { value: "active", label: t("drivers.tabs.active") },
    { value: "done", label: t("drivers.tabs.done") },
    { value: "failed", label: t("drivers.tabs.failed") },
    { value: "all", label: t("drivers.tabs.all") },
  ];

  const actionsOf = (order: Named): DriverActions => {
    const next = nextStatusesOf(order);
    return {
      pickup: canAct.pickup && next.includes("on_the_way"),
      delivered: canAct.delivered && next.includes("completed"),
      failed: canAct.failed && next.includes("delivery_failed"),
    };
  };

  const refresh = () => {
    void list.refetch();
    void summary.refetch();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-ink shadow-sm">
            <Bike className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-bold text-ink">{t("drivers.title")}</h2>
            <p className="text-sm text-muted">{date === today ? t("drivers.today") : formatDay(date)}</p>
          </div>
        </div>
        <div className="flex w-full items-end gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
            <Input
              label={t("ordersPage.dateFilter")}
              type="date"
              value={date}
              onChange={(event) => {
                // اليوم لا يُمسح، فالشاشة تبقى على يوم محدد دائماً.
                setDate(event.target.value || today);
                setPage(1);
              }}
            />
          </div>
          <button
            type="button"
            onClick={refresh}
            aria-label={t("drivers.refresh")}
            title={t("drivers.refresh")}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-soft ring-1 ring-line transition hover:ring-primary"
          >
            <RefreshCw className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      {canSummary &&
        (summary.data ? (
          <DriverSummary rows={summary.data} />
        ) : summary.isError ? (
          <ErrorState message={t("errors.unexpected")} onRetry={() => void summary.refetch()} />
        ) : (
          <Skeleton className="h-56" />
        ))}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <Segmented
            label={t("drivers.tabs.label")}
            value={tab}
            options={tabOptions}
            onChange={(value) => {
              setTab(value);
              setPage(1);
            }}
          />
          <div className="w-full md:w-80">
            <Input
              label={t("drivers.search.label")}
              placeholder={t("drivers.search.placeholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              adornment={<Search className="size-4 text-muted" aria-hidden />}
            />
          </div>
        </div>

        {rows.length > 0 && (
          <p className="text-xs text-muted">{t("drivers.resultCount", { count: visible.length })}</p>
        )}

        {list.isPending ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        ) : list.isError ? (
          <ErrorState message={t("errors.unexpected")} onRetry={() => void list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyOrders text={t("drivers.empty")} />
        ) : visible.length === 0 ? (
          <EmptyOrders text={t("drivers.noMatches")} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {visible.map((order) => {
              const id = toNumber(order.id);
              return (
                <li key={String(order.id)}>
                  <DriverOrderCard
                    order={order}
                    actions={actionsOf(order)}
                    busy={busyId === id}
                    onDetails={canShow ? () => setDetailsId(id) : null}
                    onPickup={() => act.mutate({ order, action: "pickup" })}
                    onDeliver={() => setDelivering(order)}
                    onFail={() => setFailing(order)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {meta && meta.lastPage > 1 && (
          <div className="flex justify-center">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </section>

      {detailsId !== null && (
        <OrderDetailsDialog order={detailRow} loading={details.isPending} onClose={() => setDetailsId(null)} />
      )}

      {delivering && (
        <DeliveredDialog
          order={delivering}
          busy={act.isPending}
          onConfirm={() => act.mutate({ order: delivering, action: "delivered" })}
          onClose={() => setDelivering(null)}
        />
      )}

      {failing && (
        <FailedDialog
          order={failing}
          busy={act.isPending}
          onSubmit={(reason, note) => act.mutate({ order: failing, action: "failed", reason, note })}
          onClose={() => setFailing(null)}
        />
      )}
    </div>
  );
}

/** البحث يطابق رقم الطلب والاسم والهاتف والعنوان، بلا فرق بين الأحرف الكبيرة والصغيرة. */
function matchesSearch(order: Named, query: string): boolean {
  const customer = customerOf(order);
  return [refOf(order), toText(customer.name), toText(customer.phone), toText(order.delivery_address)]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function EmptyOrders({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-muted">
        <Inbox className="size-6" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-muted">{text}</p>
    </div>
  );
}
