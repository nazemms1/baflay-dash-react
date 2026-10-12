import { api } from "@/lib/http/client";
import { toPage, unwrapData } from "@/lib/http/envelope";
import type { ListParams, Id } from "./resource";
import type { Named } from "./catalog";

/**
 * شاشة السائق: كل مسار يحرسه صلاحية `driver.orders.*`. السائق يرى طلباته وحدها، والخادم يفرض ذلك.
 * أخطاء الإجراءات تُعرض بالرمز (`code`) لا بنص الخادم، لذلك لا يعرضها المعترض العام.
 */
export const driverOrders = {
  list: (params: ListParams = {}, signal?: AbortSignal) =>
    api.get("driver/orders", { params, signal }).then((response) => toPage<Named>(response.data)),

  get: (id: Id, signal?: AbortSignal) =>
    api.get(`driver/orders/${id}`, { signal }).then((response) => unwrapData<Named>(response.data)),

  /** أرقام اليوم للسائق، وهي نفس أرقام حساب السائقين في الإدارة. */
  summary: (params: ListParams = {}, signal?: AbortSignal) =>
    api.get("driver/orders/summary", { params, signal }).then((response) => unwrapData<unknown>(response.data)),

  /** استلام من الفرع: من `preparing` إلى `on_the_way`. */
  pickup: (id: Id) =>
    api.put(`driver/orders/${id}/pickup`, {}, { silentError: true }).then((response) => response.data as unknown),

  /** تسليم للزبون: من `on_the_way` إلى `completed`. */
  delivered: (id: Id) =>
    api.put(`driver/orders/${id}/delivered`, {}, { silentError: true }).then((response) => response.data as unknown),

  /** تعذّر التسليم: من `on_the_way` إلى `delivery_failed`، ولا بد من سبب. */
  failed: (id: Id, body: { reason: string; note?: string }) =>
    api.put(`driver/orders/${id}/failed`, body, { silentError: true }).then((response) => response.data as unknown),
};
