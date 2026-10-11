import { api } from "@/lib/http/client";
import { unwrapData } from "@/lib/http/envelope";
import type { Named } from "./catalog";
import { createResource, type Id } from "./resource";

// ── المستخدمون والأدوار والصلاحيات ───────────────────────────────────────
/** حساب سابق يطابق بريداً أو هاتفاً أُطلِق من هذا الحساب، كما يعيده الخادم مع `users/{id}`. */
export interface PreviousAccount {
  id: number;
  name: string;
  orders_count?: number;
  matched_on?: string[];
}

export const users = {
  ...createResource<Named>("users"),

  /**
   * الحساب مع ما يأتي جنبه في الاستجابة: `previous_accounts` تقع خارج `data`، فتضيع لو أخذنا
   * `data` وحدها، وهي إشارة لحسابات محذوفة تطابق بريد هذا الحساب أو هاتفه.
   */
  context: (id: Id, signal?: AbortSignal) =>
    api.get(`users/${id}`, { signal }).then((response) => {
      const body = response.data as Record<string, unknown>;
      return {
        data: unwrapData<Named>(response.data),
        previousAccounts: (Array.isArray(body.previous_accounts) ? body.previous_accounts : []) as PreviousAccount[],
      };
    }),

  getAccess: (id: Id) =>
    api.get(`users/${id}/access`).then((response) => unwrapData<unknown>(response.data)),

  setAccess: (id: Id, body: Record<string, unknown>) =>
    api.put(`users/${id}/access`, body).then((response) => response.data as unknown),

  restore: (id: Id) =>
    api.put(`users/${id}/restore`, null).then((response) => response.data as unknown),

  /** حذف نهائي لا رجعة فيه، ولهذا يُستدعى من واجهة تطلب تأكيداً صريحاً. */
  purge: (id: Id) =>
    api
      .delete(`users/${id}/purge`, { silentError: true })
      .then((response) => response.data as unknown),
};

export const roles = createResource<Named>("roles");

export const permissionCatalog = {
  /** كل الصلاحيات المعروفة لتعرضها شاشة الدور للاختيار منها. */
  list: (params: { page: number; per_page: number }, signal?: AbortSignal) =>
    api
      .get("permissions", { params, signal })
      .then((response) => unwrapData<unknown>(response.data)),
};

// ── العملاء: إنشاء الزبون عند الاستبيان ─────────────────────────────────
export const customers = {
  create: (body: Record<string, unknown>) =>
    api.post("customers", body).then((response) => unwrapData<Named>(response.data)),
};

// ── لعبة الداشبورد ───────────────────────────────────────────────────────
export const gameDashboard = {
  /** قائمة اللاعبين، ومرشّحاتها: المنطقة (`branch`) والفترة من وإلى (`from`، `to`). */
  overview: (params?: Record<string, string | undefined>) =>
    api.get("game/dashboard", { params }).then((response) => unwrapData<unknown>(response.data)),
  player: (id: Id) =>
    api.get(`game/players/${id}`).then((response) => unwrapData<unknown>(response.data)),
  removePlayer: (id: Id) =>
    api.delete(`game/players/${id}`).then((response) => response.data as unknown),
};
