import { api } from "@/lib/http/client";
import { unwrapData } from "@/lib/http/envelope";
import type { RawBilingual } from "@/lib/localized";
import { createResource, type Id } from "./resource";

/** سجل بالاسم ثنائي اللغة كما يأتي من الخادم؛ الباقي يبقى في الكائن كما هو. */
export interface Named extends RawBilingual {
  id: number;
  [field: string]: unknown;
}

export const categories = createResource<Named>("categories");
export const items = createResource<Named>("items");
export const menus = createResource<Named>("menus");
export const ingredients = createResource<Named>("ingredients");
export const galleries = createResource<Named>("galleries");
export const surveys = createResource<Named>("surveys");
export const contactUs = createResource<Named>("contact-us");
export const branches = createResource<Named>("branches");

// ── الفروع: ترتيب التصنيفات داخل فرع، والكومبو العام للفرع ───────────────
export const branchApi = {
  publicGet: (id: Id, signal?: AbortSignal) =>
    api.get(`public/branches/${id}`, { signal }).then((response) => unwrapData<Named>(response.data)),

  publicCombo: (branchId: Id) =>
    api.get(`public/branches/${branchId}/combo`).then((response) => unwrapData<unknown>(response.data)),

  reorderCategories: (branchId: Id, order: Record<string, unknown>) =>
    api.put(`branches/${branchId}/categories/order`, order).then((response) => response.data as unknown),

  /** تشغيل التوصيل في الفرع أو إيقافه. الاستلام يبقى مفتوحاً في الحالتين، ومسافة التوصيل ورسومه لا تتغير. */
  setDeliveryAvailability: (branchId: Id, isAcceptingDelivery: boolean) =>
    api
      .put(`branches/${branchId}/delivery-availability`, { is_accepting_delivery: isAcceptingDelivery })
      .then((response) => response.data as unknown),

  /** الاستلام من الفرع. إيقافه مع إيقاف التوصيل معاً مرفوض (`last_order_type`). */
  setPickupAvailability: (branchId: Id, isAcceptingPickup: boolean) =>
    api
      .put(`branches/${branchId}/pickup-availability`, { is_accepting_pickup: isAcceptingPickup })
      .then((response) => response.data as unknown),

  /** جدول الدوام الأسبوعي. الأيام السبعة كلها في الجسم، و`opening_hours: null` يلغي الجدول. */
  setOpeningHours: (branchId: Id, body: Record<string, unknown>) =>
    api.put(`branches/${branchId}/opening-hours`, body).then((response) => response.data as unknown),
};

// ── الأصناف: الإضافات التي يقبلها الصنف ─────────────────────────────────
export const itemAddOns = {
  get: (itemId: Id) =>
    api.get(`items/${itemId}/add-ons`).then((response) => unwrapData<unknown>(response.data)),

  set: (itemId: Id, body: Record<string, unknown>) =>
    api.put(`items/${itemId}/add-ons`, body).then((response) => response.data as unknown),
};

// ── القوائم: الكومبو والإضافات الافتراضية والاستثناءات والاقتراحات ───────
export const menuApi = {
  publicGet: (menuId: Id) =>
    api.get(`public/menus/${menuId}`).then((response) => unwrapData<Named>(response.data)),

  publicCombo: (menuId: Id) =>
    api.get(`public/menus/${menuId}/combo`).then((response) => unwrapData<unknown>(response.data)),

  getCombo: (menuId: Id) =>
    api.get(`menus/${menuId}`).then((response) => unwrapData<Named>(response.data)),

  setCombo: (menuId: Id, body: Record<string, unknown>) =>
    api.put(`menus/${menuId}/combo`, body).then((response) => response.data as unknown),

  setExtraExclusions: (menuId: Id, body: Record<string, unknown>) =>
    api.put(`menus/${menuId}/extra-exclusions`, body).then((response) => response.data as unknown),

  setSuggestions: (menuId: Id, itemId: Id, body: Record<string, unknown>) =>
    api
      .put(`menus/${menuId}/items/${itemId}/suggestions`, body)
      .then((response) => response.data as unknown),

  /** توفّر الصنف داخل هذه القائمة. الصنف غير المتوفر يظهر للزبون رمادياً ولا يُضاف إلى السلة. */
  setItemAvailability: (menuId: Id, itemId: Id, isAvailable: boolean) =>
    api
      .put(`menus/${menuId}/items/${itemId}/availability`, { is_available: isAvailable })
      .then((response) => response.data as unknown),
};

// ── المكونات داخل قائمة معيّنة (غير كتالوج المكونات العام) ─────────────
export const menuIngredients = {
  list: (menuId: Id, signal?: AbortSignal) =>
    api
      .get(`ingredients/menus/${menuId}`, { signal })
      .then((response) => unwrapData<unknown>(response.data)),

  add: (menuId: Id, body: Record<string, unknown>) =>
    api.post(`ingredients/menus/${menuId}`, body).then((response) => response.data as unknown),

  update: (menuId: Id, ingredientId: Id, body: Record<string, unknown>) =>
    api
      .put(`ingredients/menus/${menuId}/ingredients/${ingredientId}`, body)
      .then((response) => response.data as unknown),

  remove: (menuId: Id, ingredientId: Id) =>
    api
      .delete(`ingredients/menus/${menuId}/ingredients/${ingredientId}`)
      .then((response) => response.data as unknown),

  /**
   * تعديل بيانات المكوّن الكتالوجي من داخل القائمة. الأصل يرسلها بهذه المفاتيح
   * بالضبط (`ingredients.name`)، ويرسل الطلب بـ POST مع `_method=PUT`.
   */
  updateCatalog: (menuId: Id, ingredientId: Id, form: FormData) => {
    form.set("_method", "PUT");
    return api
      .post(`ingredients/menus/${menuId}/ingredients/${ingredientId}`, form)
      .then((response) => response.data as unknown);
  },
};

// ── الإضافات العامة للطلب (order-extras) ───────────────────────────────
export const orderExtras = {
  get: () => api.get("order-extras").then((response) => unwrapData<unknown>(response.data)),
  set: (body: Record<string, unknown>) =>
    api.put("order-extras", body).then((response) => response.data as unknown),
};

// ── المعارض: تحديث الصورة وحدها ─────────────────────────────────────────
export const galleryImages = {
  updateImage: (galleryId: Id, imageId: Id, form: FormData) => {
    form.set("_method", "PUT");
    return api
      .post(`galleries/${galleryId}/images/${imageId}`, form)
      .then((response) => response.data as unknown);
  },
};
