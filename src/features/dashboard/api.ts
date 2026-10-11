import { api } from "@/lib/http/client";
import { unwrapData } from "@/lib/http/envelope";
import { toCustomers, toOperations, toOverview, toProducts } from "./mappers";
import type { DashboardFilters } from "./types";

/**
 * المعاملات التي تقبلها المسارات الأربعة جميعاً. المدى المخصّص يغني عن الفترة
 * الجاهزة، والفارغ لا يُرسل أصلاً كي لا يصل `branch_id=null` إلى الخادم.
 */
function toParams(filters: DashboardFilters): Record<string, string | number> {
  const params: Record<string, string | number> =
    filters.from && filters.to
      ? { from: filters.from, to: filters.to }
      : { period: filters.period };

  if (filters.branchId !== null) {
    params.branch_id = filters.branchId;
  }
  return params;
}

function fetchSection(path: string, filters: DashboardFilters, signal?: AbortSignal) {
  return api
    .get(path, { params: toParams(filters), signal })
    .then((response) => unwrapData<unknown>(response.data));
}

export const dashboardApi = {
  overview: (filters: DashboardFilters, signal?: AbortSignal) =>
    fetchSection("admin/dashboard", filters, signal).then(toOverview),

  operations: (filters: DashboardFilters, signal?: AbortSignal) =>
    fetchSection("admin/dashboard/operations", filters, signal).then(toOperations),

  products: (filters: DashboardFilters, signal?: AbortSignal) =>
    fetchSection("admin/dashboard/products", filters, signal).then(toProducts),

  customers: (filters: DashboardFilters, signal?: AbortSignal) =>
    fetchSection("admin/dashboard/customers", filters, signal).then(toCustomers),
};
