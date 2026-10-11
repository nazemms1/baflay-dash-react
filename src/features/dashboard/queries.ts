import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { branches } from "@/services";
import { dashboardApi } from "./api";
import type { DashboardFilters } from "./types";

/**
 * كل قسم له استعلامه المستقل: فشل قسم لا يُسقط البقية، ولا يُطلب قسم إلا إن
 * كان تبويبه مفتوحاً (`enabled`). مفتاح الاستعلام يتضمن الفلاتر كاملة، فيُعاد
 * الجلب عند كل تغيير وتبقى النتيجة السابقة ظاهرة أثناء الانتظار.
 */
function useSection<T>(
  section: string,
  filters: DashboardFilters,
  fetcher: (filters: DashboardFilters, signal?: AbortSignal) => Promise<T>,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["dashboard", section, filters],
    queryFn: ({ signal }) => fetcher(filters, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export const useOverview = (filters: DashboardFilters, enabled = true) =>
  useSection("overview", filters, dashboardApi.overview, enabled);

export const useOperations = (filters: DashboardFilters, enabled = true) =>
  useSection("operations", filters, dashboardApi.operations, enabled);

export const useProducts = (filters: DashboardFilters, enabled = true) =>
  useSection("products", filters, dashboardApi.products, enabled);

export const useCustomers = (filters: DashboardFilters, enabled = true) =>
  useSection("customers", filters, dashboardApi.customers, enabled);

/** قائمة الفروع لمحدّد الفرع. لا تُطلب أصلاً لحساب مقصور على فرع واحد. */
export function useBranchOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["branches", "options"],
    queryFn: ({ signal }) => branches.list({ per_page: 200 }, signal),
    enabled,
    staleTime: 5 * 60_000,
  });
}
