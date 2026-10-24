import type { TFunction } from "i18next";
import type { CrudModule, FieldDef, Values } from "@/components/crud/types";
import { defaultValues } from "@/components/crud/payload";
import { ItemAddonsAction } from "@/features/items/ItemAddonsAction";
import { MenuDetails } from "@/features/menus/MenuDetails";
import { MenuRowActions } from "@/features/menus/MenuRowActions";
import { CityForm } from "@/features/geography/CityForm";
import { CityBranchesCell, CityStateCell } from "@/features/geography/CityColumns";
import { BranchRowActions } from "@/features/branches/BranchRowActions";
import { BranchStatusBadge } from "@/features/branches/BranchStatusBadge";
import { localizedRecord } from "@/lib/localized";
import { branches, categories, cities, countries, ingredients, items, menus, states, type GeoEntity, type Named } from "@/services";
import { flagColumn, imageColumn, nameColumn, relationName, remoteSource, textColumn } from "./shared";

const DELETE = ["destroy", "delete"] as const;

/** الدول: اسم بالعربية والإنجليزية فقط، كما في الأصلي. */
export const countriesModule = (t: TFunction): CrudModule<GeoEntity> => ({
  id: "countries",
  titleKey: "nav.countries",
  api: {
    list: countries.list,
    get: countries.get,
    create: countries.create,
    update: countries.update,
    remove: countries.remove,
  },
  fields: [{ kind: "bilingual", key: "name", label: t("crud.field.name"), required: true }],
  columns: [nameColumn<GeoEntity>()],
  permissions: {
    index: "countries.index",
    create: "countries.store",
    update: "countries.update",
    delete: DELETE.map((action) => `countries.${action}`),
  },
  nameOf: (row, language) => localizedRecord(row, language),
});

/** المدن: تنتمي إلى ولاية، والولايات تُجلب من الخادم لتعرض قائمة الاختيار. */
export const citiesModule = (t: TFunction): CrudModule<GeoEntity> => ({
  id: "cities",
  titleKey: "nav.cities",
  api: {
    list: cities.list,
    get: cities.get,
    create: cities.create,
    update: cities.update,
    remove: cities.remove,
  },
  fields: [
    { kind: "bilingual", key: "name", label: t("crud.field.name"), required: true },
    {
      kind: "select",
      key: "state_id",
      label: t("crud.field.state"),
      options: remoteSource("states", states),
    },
  ],
  // النموذج المخصص يضيف الولاية من داخله، وهذا ما كان يفعله الداشبورد القديم.
  form: CityForm,
  // الولاية والبلد من قائمة الولايات، والفروع من السجل نفسه: كل ما يلزم لمعرفة موقع المدينة.
  columns: [
    nameColumn<GeoEntity>(),
    {
      key: "state",
      header: t("crud.col.state"),
      render: (row) => <CityStateCell row={row} />,
    },
    {
      key: "branches",
      header: t("crud.col.branches"),
      render: (row) => <CityBranchesCell row={row} />,
    },
  ],
  permissions: {
    index: "cities.index",
    create: "cities.store",
    update: "cities.update",
    delete: DELETE.map((action) => `cities.${action}`),
  },
  nameOf: (row, language) => localizedRecord(row, language),
});

/** التصنيفات: اسم وصورة. */
export const categoriesModule = (t: TFunction): CrudModule<Named> => ({
  id: "categories",
  titleKey: "nav.categories",
  api: {
    list: categories.list,
    get: categories.get,
    create: categories.create,
    update: categories.update,
    remove: categories.remove,
  },
  multipart: true,
  fields: [
    { kind: "bilingual", key: "name", label: t("crud.field.name"), required: true },
    { kind: "image", key: "image", label: t("crud.field.image") },
  ],
  columns: [imageColumn<Named>("image", ""), nameColumn<Named>()],
  permissions: {
    index: "categories.index",
    create: "categories.store",
    update: "categories.update",
    delete: DELETE.map((action) => `categories.${action}`),
  },
  nameOf: (row, language) => localizedRecord(row, language),
});

/** الفروع: البيانات الأساسية ومكان الفرع وإعدادات التوصيل، وترسل كـ `FormData`. */
/** حقول رقمية يُفرَّغ فيها الفارغ بإرسال نص فارغ، فالخادم يحوّله إلى `null`. */
const BRANCH_NULLABLE_NUMBERS = [
  "delivery_radius_km",
  "delivery_price_per_km",
  "delivery_minutes_min",
  "delivery_minutes_max",
  "location_x",
  "location_y",
];

/**
 * تطبيع حمولة الفرع قبل الإرسال كما يتوقعه الخادم: الرقم الفارغ يصير نصاً فارغاً
 * ليُفرَّغ، ورسوم التوصيل الفارغة صفراً لأنها أساس دائم.
 */
function normalizeBranchPayload(values: Values): Values {
  const payload: Values = { ...values };
  for (const key of BRANCH_NULLABLE_NUMBERS) {
    if (payload[key] === null || payload[key] === undefined) payload[key] = "";
  }
  payload.delivery_fee = payload.delivery_fee ?? 0;
  return payload;
}

export const branchesModule = (t: TFunction): CrudModule<Named> => {
  const fields: FieldDef[] = [
    { kind: "bilingual", key: "name", label: t("crud.field.name"), required: true, group: t("crud.group.basic") },
    { kind: "bilingual", key: "address", label: t("crud.field.address"), group: t("crud.group.basic") },
    { kind: "phone", key: "phone_number", label: t("crud.field.phone"), ltr: true, group: t("crud.group.basic") },
    {
      kind: "select",
      key: "city_id",
      label: t("crud.field.city"),
      group: t("crud.group.basic"),
      options: remoteSource("cities", cities),
    },
    { kind: "image", key: "image", label: t("crud.field.image"), group: t("crud.group.basic"), ratio: 16 / 9 },
    {
      // في الأصلي `location_x` هو خط العرض و`location_y` خط الطول.
      kind: "location",
      key: "location_x",
      lngKey: "location_y",
      radiusKey: "delivery_radius_km",
      label: t("crud.field.deliveryArea"),
      group: t("crud.group.location"),
    },
    { kind: "number", key: "delivery_fee", label: t("crud.field.deliveryFee"), group: t("crud.group.delivery"), min: 0 },
    { kind: "number", key: "delivery_price_per_km", label: t("crud.field.deliveryPricePerKm"), group: t("crud.group.delivery"), min: 0, max: 1000000 },
    { kind: "number", key: "delivery_minutes_min", label: t("crud.field.deliveryMinMinutes"), group: t("crud.group.delivery"), min: 0 },
    { kind: "number", key: "delivery_minutes_max", label: t("crud.field.deliveryMaxMinutes"), group: t("crud.group.delivery"), min: 0, notBelow: "delivery_minutes_min" },
    { kind: "switch", key: "is_visible", label: t("crud.field.isVisible"), defaultValue: true, requires: "branches.availability.update", group: t("crud.group.status") },
    // الإغلاق المؤقت تديره مواعيد العمل، والخادم يتجاهل تعديله، فيُعرض فقط.
    { kind: "switch", key: "is_accepting_orders", label: t("crud.field.isAcceptingOrders"), readOnly: true, group: t("crud.group.status") },
    { kind: "text", key: "unavailable_reason", label: t("crud.field.unavailableReason"), readOnly: true, group: t("crud.group.status") },
  ];

  return {
    id: "branches",
    titleKey: "nav.branches",
    api: {
      list: branches.list,
      get: branches.get,
      create: branches.create,
      update: branches.update,
      remove: branches.remove,
    },
    multipart: true,
    toPayload: normalizeBranchPayload,
    fields,
    columns: [
      imageColumn<Named>("image", ""),
      nameColumn<Named>(),
      textColumn<Named>("phone_number", t("crud.field.phone")),
      flagColumn<Named>("is_visible", t("crud.field.isVisible"), { on: t("crud.visible"), off: t("crud.hidden") }),
      flagColumn<Named>("is_accepting_orders", t("crud.field.isAcceptingOrders"), { on: t("crud.open"), off: t("crud.closed") }),
      flagColumn<Named>("is_accepting_delivery", t("crud.field.isAcceptingDelivery"), { on: t("crud.deliveryOn"), off: t("crud.deliveryOff") }),
      flagColumn<Named>("is_accepting_pickup", t("orderTypes.pickupField"), { on: t("orderTypes.pickupOn"), off: t("orderTypes.pickupOff") }),
      { key: "status_now", header: t("branchStatus.column"), render: (row) => <BranchStatusBadge row={row} /> },
    ],
    rowActions: BranchRowActions,
    permissions: {
      index: "branches.index",
      show: "branches.show",
      create: "branches.store",
      update: "branches.update",
      delete: DELETE.map((action) => `branches.${action}`),
    },
    nameOf: (row, language) => localizedRecord(row, language),
  };
};

/** الأصناف: الاسم والوصف والصورة والتصنيف والقوائم التي يظهر فيها. السعر يخص الصنف داخل كل قائمة، فلا يُدخل على الصنف نفسه. */
export const itemsModule = (t: TFunction): CrudModule<Named> => ({
  id: "items",
  titleKey: "nav.items",
  api: {
    list: items.list,
    get: items.get,
    create: items.create,
    update: items.update,
    remove: items.remove,
  },
  multipart: true,
  fields: [
    { kind: "bilingual", key: "name", label: t("crud.field.name"), required: true },
    { kind: "bilingual", key: "description", label: t("crud.field.description"), multiline: true },
    { kind: "image", key: "image", label: t("crud.field.image") },
    {
      kind: "select",
      key: "category_id",
      label: t("crud.field.category"),
      options: remoteSource("categories", categories),
    },
    {
      kind: "rows",
      key: "menus",
      label: t("crud.field.menus"),
      columns: [
        {
          key: "menu_id",
          label: t("crud.field.menu"),
          kind: "select",
          required: true,
          searchable: true,
          // القائمة المختارة هي السجل نفسه، فمعرّفها يصير معرّف الصف عند التعديل.
          self: true,
          options: remoteSource("menus", menus, (row, language) =>
            [localizedRecord(row, language), relationName(row, "branch", language)].filter(Boolean).join(" · ")
          ),
        },
        { key: "price", label: t("crud.field.price"), kind: "number", required: true },
        {
          key: "currency",
          label: t("crud.field.priceCurrency"),
          kind: "select",
          required: true,
          options: MENU_CURRENCIES.map((value) => ({ value, label: value })),
        },
      ],
      // لكل قائمة يُضاف إليها الصنف سعرها ووحدتها، فلا سعر واحد يصلح لكل القوائم.
      newRow: { menu_id: null, price: null, currency: null },
      // سعر الوجبة لكل قائمة: يظهر في التفاصيل فقط، ويحدده الخادم من إعدادات القائمة.
      viewColumns: [{ key: "meal_price", label: t("crud.field.mealPrice"), kind: "number" }],
    },
  ],
  columns: [
    imageColumn<Named>("image", ""),
    nameColumn<Named>(),
    textColumn<Named>("category", t("crud.field.category"), (row) => (
      <span className="text-ink-soft">{relationName(row, "category", "ar")}</span>
    )),
  ],
  // البحث يُرسل إلى الخادم بالمعامل `search`، والقائمة مرقّمة 20 صفاً في كل صفحة.
  searchParam: "search",
  rowActions: ItemAddonsAction,
  permissions: {
    index: "items.index",
    show: "items.show",
    create: "items.store",
    update: "items.update",
    delete: DELETE.map((action) => `items.${action}`),
  },
  nameOf: (row, language) => localizedRecord(row, language),
});

/** المكونات (الكتالوج): الاسم والسعر والحالة. */
export const ingredientsModule = (t: TFunction): CrudModule<Named> => ({
  id: "ingredients",
  titleKey: "nav.ingredients",
  api: {
    list: ingredients.list,
    get: ingredients.get,
    create: ingredients.create,
    update: ingredients.update,
    remove: ingredients.remove,
  },
  multipart: true,
  fields: [
    { kind: "bilingual", key: "name", label: t("crud.field.name"), required: true },
    { kind: "number", key: "price", label: t("crud.field.price"), ltr: true },
    {
      kind: "select",
      key: "status",
      label: t("crud.field.status"),
      options: [
        { value: "active", label: t("crud.status.active") },
        { value: "inactive", label: t("crud.status.inactive") },
      ],
    },
    { kind: "image", key: "image", label: t("crud.field.image") },
  ],
  columns: [
    imageColumn<Named>("image", ""),
    nameColumn<Named>(),
    textColumn<Named>("price", t("crud.field.price")),
    textColumn<Named>("status", t("crud.field.status")),
  ],
  permissions: {
    index: "ingredients.index",
    show: "ingredients.show",
    create: "ingredients.create",
    update: "ingredients.update",
    delete: DELETE.map((action) => `ingredients.${action}`),
  },
  nameOf: (row, language) => localizedRecord(row, language),
});

/** العملات التي تُختار للقائمة. العملة تخص القائمة كلها، لا كل صنف على حدة. */
const MENU_CURRENCIES = ["USD", "SYP", "AED", "IQD"];

/** حقول القائمة: الاسم والفرع والعملة، ثم سطور أصنافها بالترتيب. */
const menuFields = (t: TFunction): FieldDef[] => [
  { kind: "text", key: "name", label: t("crud.field.name"), required: true },
  {
    kind: "select",
    key: "branch_id",
    label: t("crud.field.branch"),
    options: remoteSource("branches", branches, (row) => localizedRecord(row, "ar")),
  },
  {
    kind: "select",
    key: "currency",
    label: t("crud.field.menuCurrency"),
    required: true,
    options: MENU_CURRENCIES.map((value) => ({ value, label: value })),
  },
  {
    kind: "rows",
    key: "items",
    label: t("crud.field.menuItems"),
    // الترتيب بالسحب والإفلات، ويُحفظ تلقائياً في `order` حسب موضع الصف.
    sortable: true,
    orderKey: "order",
    columns: [
      {
        key: "item_id",
        label: t("crud.field.item"),
        kind: "select",
        required: true,
        searchable: true,
        self: true,
        // بحث الأصناف على الخادم: يجد الحقل أي صنف مهما كثر، دون تنزيل القائمة كلها.
        options: remoteSource("items", items, (row, language) =>
          localizedRecord(row, language),
        ),
      },
      // السعر لكل صنف داخل القائمة إلزامي، فالسطر بلا سعر ناقص.
      { key: "price", label: t("crud.field.price"), kind: "number", required: true },
    ],
    newRow: { item_id: null, price: null, order: 1 },
  },
];

/** عملة القائمة المحفوظة، أو عملة أول صنف فيها إن لم تُحفظ على القائمة نفسها. */
const menuCurrencyOf = (record: Record<string, unknown>): string => {
  if (typeof record.currency === "string" && record.currency) return record.currency;
  const first = Array.isArray(record.items) ? (record.items[0] as Record<string, unknown> | undefined) : undefined;
  return typeof first?.currency === "string" && first.currency ? first.currency : MENU_CURRENCIES[0];
};

/**
 * القوائم: الاسم والفرع والعملة، وسطور الأصناف مع سعر كل صنف وترتيبه. العملة
 * تُختار مرة واحدة للقائمة، وتُطبَّق تلقائياً على كل صنف عند الحفظ.
 */
export const menusModule = (t: TFunction): CrudModule<Named> => ({
  id: "menus",
  titleKey: "nav.menus",
  api: {
    list: menus.list,
    get: menus.get,
    create: menus.create,
    update: menus.update,
    remove: menus.remove,
  },
  fields: menuFields(t),
  toValues: (record) => {
    const source = record as unknown as Record<string, unknown>;
    const values = defaultValues(menuFields(t), source);
    values.currency = menuCurrencyOf(source);
    return values;
  },
  toPayload: (values) => {
    const currency = values.currency;
    const rows = Array.isArray(values.items)
      ? (values.items as Record<string, unknown>[]).map((row) => ({ ...row, currency }))
      : values.items;
    return { ...values, items: rows };
  },
  columns: [
    textColumn<Named>("name", t("crud.field.name")),
    textColumn<Named>("branch", t("crud.field.branch"), (row) => (
      <span className="text-ink-soft">{relationName(row, "branch", "ar")}</span>
    )),
  ],
  rowActions: MenuRowActions,
  details: MenuDetails,
  permissions: {
    index: "menus.index",
    show: "menus.show",
    create: "menus.store",
    update: "menus.update",
    delete: DELETE.map((action) => `menus.${action}`),
  },
  nameOf: (row) => String((row as Record<string, unknown>).name ?? row.id),
});
