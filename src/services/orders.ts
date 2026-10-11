import { api } from "@/lib/http/client";
import { unwrapData, toPage } from "@/lib/http/envelope";
import type { ListParams } from "./resource";
import { createResource, type Id } from "./resource";
import type { Named } from "./catalog";

/**
 * مسارات الطلب على جبهتين: `admin/orders` للإدارة، و`orders` لمسار الإنشاء
 * والزبون. الشاشتان تتشاركان الكيان نفسه وتختلفان في الصلاحية والنتيجة.
 */

export const orderAdmin = {
  list: (params: ListParams = {}, signal?: AbortSignal) =>
    api.get("admin/orders", { params, signal }).then((response) => toPage<Named>(response.data)),

  get: (id: Id, signal?: AbortSignal) =>
    api
      .get(`admin/orders/${id}`, { signal })
      .then((response) => unwrapData<Named>(response.data)),

  invoice: (id: Id) =>
    api.get(`admin/orders/${id}/invoice`).then((response) => unwrapData<unknown>(response.data)),

  setStatus: (id: Id, body: Record<string, unknown>) =>
    api.put(`admin/orders/${id}/status`, body).then((response) => response.data as unknown),
};

/**
 * طلب الكاشير داخل الداشبورد: الطلب كله في نداء واحد. الخادم يحدد القناة (داخلي) ويعيد
 * الطلب مقدّماً، فلا يرسل الداشبورد القناة ولا المبالغ.
 */
export const counterOrders = {
  create: (body: Record<string, unknown>) =>
    api.post("admin/orders", body).then((response) => unwrapData<Named>(response.data)),
};

const flow = createResource<Named>("orders");

export const orders = {
  ...flow,
  start: (body: Record<string, unknown>) =>
    api.post("orders/start", body).then((response) => unwrapData<Named>(response.data)),

  addMenuItems: (orderId: Id, body: Record<string, unknown>) =>
    api
      .post(`orders/${orderId}/menu-items`, body)
      .then((response) => unwrapData<Named>(response.data)),

  removeItem: (orderId: Id, itemId: Id) =>
    api
      .delete(`orders/${orderId}/items/${itemId}`)
      .then((response) => unwrapData<Named>(response.data)),

  /** تعديل كمية سطر في الطلب، كما يفعل الموقع الرسمي. */
  setItemQuantity: (orderId: Id, rowId: Id, quantity: number) =>
    api
      .put(`orders/${orderId}/items/${rowId}`, { quantity })
      .then((response) => unwrapData<Named>(response.data)),

  addCustomBurger: (orderId: Id, body: Record<string, unknown>) =>
    api
      .post(`orders/${orderId}/custom-burger`, body)
      .then((response) => unwrapData<Named>(response.data)),

  submit: (orderId: Id, body: Record<string, unknown> = {}) =>
    api
      .post(`orders/${orderId}/submit`, body)
      .then((response) => unwrapData<Named>(response.data)),

  /** السبب اختياري، ويُرسل حين يريد الكاشير توثيق سبب الإلغاء. */
  cancel: (orderId: Id, reason?: string | null) =>
    api
      .post(`orders/${orderId}/cancel`, reason ? { reason } : {})
      .then((response) => unwrapData<Named>(response.data)),
};
