import { asArray, asRecord, toNumber, toText } from "@/lib/coerce";

/**
 * منطق مكوّنات القائمة، بلا واجهة. كل قائمة (لفرع) تربط مكوّنات الكتالوج
 * بسعرها وعملتها الخاصتين، والشاشة تحسب الفرق بين الحالة المحفوظة والمعدَّلة
 * ثم تحوّله إلى إضافة وتعديل وحذف، كما يفعل الأصل.
 */

export interface CatalogIngredient {
  id: number;
  name: string;
  nameAr: string;
  image: string | null;
  status: string;
}

/** سطر ربط محفوظ على الخادم لمكوّن داخل قائمة. */
export interface MenuLink {
  ingredientId: number;
  price: number;
  currency: string;
}

/** صف في الشاشة: مكوّن كتالوجي مع حالته المحفوظة وحالته المعدَّلة. */
export interface IngredientRow extends CatalogIngredient {
  isLinked: boolean;
  price: number;
  currency: string;
  originalIsLinked: boolean;
  originalPrice: number;
  originalCurrency: string;
}

export interface SavePlan {
  add: IngredientRow[];
  update: IngredientRow[];
  remove: IngredientRow[];
}

export const CURRENCIES = ["USD", "SYP", "AED", "IQD"] as const;
export const DEFAULT_CURRENCY = "USD";

/**
 * شكل الجواب يختلف بين إصدارات الخادم: مصفوفة مباشرة، أو `{ data: [...] }`، أو
 * `{ ingredients: [...] }`. نقرأ الثلاثة من مكان واحد.
 */
export function normalizeLinks(body: unknown): MenuLink[] {
  const root = asRecord(body);
  const rows = Array.isArray(body)
    ? (body as unknown[])
    : Array.isArray(root.data)
      ? (root.data as unknown[])
      : asArray(root.ingredients);

  return rows.map((entry) => {
    const row = asRecord(entry);
    return {
      ingredientId: toNumber(row.ingredient_id ?? row.id),
      price: toNumber(row.price),
      currency: toText(row.currency) || DEFAULT_CURRENCY,
    };
  });
}

/** المكوّنات الكتالوجية مدموجةً مع روابط القائمة الحالية. */
export function buildRows(catalog: CatalogIngredient[], links: MenuLink[]): IngredientRow[] {
  const linked = new Map(links.map((link) => [link.ingredientId, link]));

  return catalog.map((ingredient) => {
    const link = linked.get(ingredient.id);
    const isLinked = link !== undefined;
    const price = link?.price ?? 0;
    const currency = link?.currency ?? DEFAULT_CURRENCY;
    return {
      ...ingredient,
      isLinked,
      price,
      currency,
      originalIsLinked: isLinked,
      originalPrice: price,
      originalCurrency: currency,
    };
  });
}

/** هل تغيّر الصف عن حالته المحفوظة؟ مصدر واحد لهذا الحكم في الشاشة كلها. */
export function hasChanged(row: IngredientRow): boolean {
  return (
    row.isLinked !== row.originalIsLinked ||
    (row.isLinked && (row.price !== row.originalPrice || row.currency !== row.originalCurrency))
  );
}

/** الفرق بين المحفوظ والمعدَّل مقسوماً على العمليات الثلاث التي يفهمها الخادم. */
export function planSave(rows: IngredientRow[]): SavePlan {
  const changed = rows.filter(hasChanged);
  return {
    add: changed.filter((row) => row.isLinked && !row.originalIsLinked),
    update: changed.filter(
      (row) => row.isLinked && row.originalIsLinked && (row.price !== row.originalPrice || row.currency !== row.originalCurrency)
    ),
    remove: changed.filter((row) => !row.isLinked && row.originalIsLinked),
  };
}

/** الخادم يرفض الربط بسعر صفر، فنتحقق قبل الإرسال حتى لا تفشل دفعة كاملة. */
export function unpricedLinks(plan: SavePlan): IngredientRow[] {
  return [...plan.add, ...plan.update].filter((row) => !(row.price > 0));
}

/** ربط مكوّن جديد يبدأ بسعر 1 بدل الصفر، كما في الأصل. */
export function linkRow(row: IngredientRow): IngredientRow {
  return { ...row, isLinked: true, price: row.price > 0 ? row.price : 1 };
}
