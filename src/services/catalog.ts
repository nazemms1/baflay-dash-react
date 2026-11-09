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

// ── تفاصيل الصنف لكل فرع: صورة ووصفان يحلّان محل العام داخل قائمة الفرع ──
/** التفاصيل التي حفظها الفرع لصنف في قائمته. `null` في الحقل يعني أن الفرع لم يغيّره فيرث العام. */
export interface ItemBranchDetails {
  image: string | null;
  description: string | null;
  description_ar: string | null;
}

/** ما يعيده الخادم بعد حفظ تفاصيل صنف لفرع أو إرجاعها إلى العام. */
export interface MenuItemDetailsChange {
  menu_id: number;
  item_id: number;
  /** الصورة والوصفان كما يراهما زبون هذا الفرع: الخاصة إن وُجدت، وإلا العامة. */
  image: string | null;
  description: string | null;
  description_ar: string | null;
  branch_details: ItemBranchDetails | null;
  default_image: string | null;
  default_description: string | null;
  default_description_ar: string | null;
}

/**
 * ما يُرسل عند الحفظ. كل حقل اختياري، وما لا يُرسل لا يتغيّر. الوصف الفارغ يرجع إلى العام،
 * و`remove_image` يرجع الصورة إلى العامة، ولا يُرسل مع `image` في الطلب نفسه.
 */
export interface ItemDetailsPatch {
  image?: File;
  remove_image?: boolean;
  description?: string;
  description_ar?: string;
}

/** صورة تصنيف داخل فرع: الصورة المعروضة، والعامة، وصورة الفرع الخاصة إن وُجدت. */
export interface BranchCategoryImage extends RawBilingual {
  id: number;
  /** هل يبيع الفرع شيئاً من هذا التصنيف الآن. */
  on_menu: boolean;
  /** الصورة التي تظهر للزبون: صورة الفرع إن وُجدت، وإلا العامة، وفارغة إن لم توجد أيٌّ منهما. */
  image: string;
  /** الصورة العامة للتصنيف، وفارغة إن لم تُرفع. */
  default_image: string;
  /** صورة الفرع الخاصة، و`null` إن لم يرفع الفرع صورة. */
  branch_image: string | null;
}

/** كل تصنيفات الفرع بترتيب الفرع نفسه. */
export interface BranchCategoryImages {
  branch_id: number;
  categories: BranchCategoryImage[];
}

/** ما يعيده الخادم بعد رفع صورة الفرع لتصنيف أو حذفها. */
export interface BranchCategoryImageChange {
  branch_id: number;
  category_id: number;
  image: string;
  default_image: string;
  branch_image: string | null;
}

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

  /**
   * الاستلام من الفرع. يجوز إيقافه مع التوصيل معاً: يبقى الفرع مفتوحاً ويرجع `accepts_online_orders: false`
   * و`online_orders_unavailable_reason: no_order_types`.
   */
  setPickupAvailability: (branchId: Id, isAcceptingPickup: boolean) =>
    api
      .put(`branches/${branchId}/pickup-availability`, { is_accepting_pickup: isAcceptingPickup })
      .then((response) => response.data as unknown),

  /**
   * طرق الدفع في الفرع: النقد والبطاقة، ويُرسل منهما ما يُراد تغييره. يجوز إيقافهما معاً: يبقى الفرع مفتوحاً
   * ويرجع `accepts_online_orders: false` و`online_orders_unavailable_reason: no_payment_methods`. والبطاقة
   * لا تُفعَّل لفرع بلا حساب إلكتروني.
   */
  setPaymentMethods: (branchId: Id, body: { accepts_cash?: boolean; accepts_card?: boolean }) =>
    api.put(`branches/${branchId}/payment-methods`, body).then((response) => response.data as unknown),

  /** جدول الدوام الأسبوعي. الأيام السبعة كلها في الجسم، و`opening_hours: null` يلغي الجدول. */
  setOpeningHours: (branchId: Id, body: Record<string, unknown>) =>
    api.put(`branches/${branchId}/opening-hours`, body).then((response) => response.data as unknown),

  /** صور تصنيفات الفرع كلها، بترتيب الفرع، ومعها `on_menu` لما يبيعه الفرع الآن. */
  categoryImages: (branchId: Id, signal?: AbortSignal) =>
    api
      .get(`branches/${branchId}/categories/images`, { signal })
      .then((response) => unwrapData<BranchCategoryImages>(response.data)),

  /** رفع صورة خاصة بالفرع لتصنيف، أو تبديلها. الملف يذهب بـ `POST` مع `_method=PUT` كبقية الملفات. */
  uploadCategoryImage: (branchId: Id, categoryId: Id, file: File) => {
    const form = new FormData();
    form.append("_method", "PUT");
    form.append("image", file);
    return api
      .post(`branches/${branchId}/categories/${categoryId}/image`, form)
      .then((response) => unwrapData<BranchCategoryImageChange>(response.data));
  },

  /** حذف صورة الفرع للتصنيف، فيعود الفرع إلى الصورة العامة. */
  resetCategoryImage: (branchId: Id, categoryId: Id) =>
    api
      .delete(`branches/${branchId}/categories/${categoryId}/image`)
      .then((response) => unwrapData<BranchCategoryImageChange>(response.data)),
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

  /**
   * هل يظهر خيار الكومبو (الوجبة) لهذا الصنف داخل القائمة. سعر الكومبو واحد للقائمة، وهذا يستثني
   * منه الصنف. يعيد الخادم الحالة المحفوظة في `data.has_combo`.
   */
  setItemCombo: (menuId: Id, itemId: Id, hasCombo: boolean) =>
    api
      .put(`menus/${menuId}/items/${itemId}/combo`, { has_combo: hasCombo })
      .then((response) => response.data as unknown),

  /** توفّر الصنف داخل هذه القائمة. الصنف غير المتوفر يظهر للزبون رمادياً ولا يُضاف إلى السلة. */
  setItemAvailability: (menuId: Id, itemId: Id, isAvailable: boolean) =>
    api
      .put(`menus/${menuId}/items/${itemId}/availability`, { is_available: isAvailable })
      .then((response) => response.data as unknown),

  /**
   * حفظ صورة الصنف ووصفه في هذا الفرع، ولا يُرسل إلا ما تغيّر. مع ملف صورة يذهب الطلب `FormData` بـ `POST`
   * و`_method=PUT`، وبدونه `PUT` بـ JSON.
   */
  saveItemDetails: (menuId: Id, itemId: Id, patch: ItemDetailsPatch) => {
    const url = `menus/${menuId}/items/${itemId}/details`;
    if (patch.image) {
      const form = new FormData();
      form.append("_method", "PUT");
      form.append("image", patch.image);
      if (patch.description !== undefined) form.append("description", patch.description);
      if (patch.description_ar !== undefined) form.append("description_ar", patch.description_ar);
      return api.post(url, form).then((response) => unwrapData<MenuItemDetailsChange>(response.data));
    }
    const body: Record<string, unknown> = {};
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.description_ar !== undefined) body.description_ar = patch.description_ar;
    if (patch.remove_image) body.remove_image = true;
    return api.put(url, body).then((response) => unwrapData<MenuItemDetailsChange>(response.data));
  },

  /** إرجاع صورة الصنف ووصفه في هذا الفرع إلى العامين. يُقبل حتى لو لم يكن للفرع شيء محفوظ. */
  resetItemDetails: (menuId: Id, itemId: Id) =>
    api
      .delete(`menus/${menuId}/items/${itemId}/details`)
      .then((response) => unwrapData<MenuItemDetailsChange>(response.data)),
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

  /** حذف صورة واحدة من المعرض. */
  remove: (galleryId: Id, imageId: Id) =>
    api.delete(`galleries/${galleryId}/images/${imageId}`).then((response) => response.data as unknown),
};
