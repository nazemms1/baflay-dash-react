import type { TFunction } from "i18next";
import type { CrudModule } from "@/components/crud/types";
import { localizedRecord } from "@/lib/localized";
import type { Option } from "@/components/ui/Fields";
import { GENERAL_MARKET, marketOptions } from "@/features/markets/marketOptions";
import { galleries, galleryImages, ingredients, type Named } from "@/services";
import { ApiError } from "@/lib/http/errors";
import i18n from "@/i18n";
import { nameColumn, textColumn } from "./shared";
import { ingredientsModule } from "./catalog";

const DELETE = ["destroy", "delete"] as const;

/** شكل المعرض يحدده حقل `layout` وحده، لا اسمه بأي لغة. */
const GALLERY_LAYOUTS = ["offer", "instagram", "events", "standard"] as const;

/** رمز السوق كما يعيده الخادم، أو `null` لمعرض مشترك. */
const marketCodeOf = (gallery: Named): string | null =>
  typeof gallery.market_code === "string" && gallery.market_code !== "" ? gallery.market_code : null;

/**
 * الخادم يعيد `market_code`، والنموذج والتفاصيل يقرآن `market` كما يُرسل. المعرض المشترك يصير
 * `general`، وهكذا يظهر في القائمة المنسدلة وتعرف الحفظ بالقيمة نفسها.
 */
const withMarketField = (gallery: Named): Named => ({
  ...gallery,
  market: marketCodeOf(gallery) ?? GENERAL_MARKET,
});

const layoutOptions = (t: TFunction): Option[] =>
  GALLERY_LAYOUTS.map((layout) => ({ value: layout, label: t(`galleries.layouts.${layout}`) }));

/** صف صورة كما يرسله النموذج: `images[i][id]`، و`images[i][instagram_url]`، والملف فقط إن اختير ملف جديد. */
interface ImageRow {
  id?: number;
  instagram_url: string;
  image?: File;
}

const imageRowsOf = (form: FormData): ImageRow[] => {
  const rows = new Map<number, Partial<ImageRow>>();
  form.forEach((value, key) => {
    const match = /^images\[(\d+)\]\[(id|instagram_url|image)\]$/.exec(key);
    if (!match) return;
    const index = Number(match[1]);
    const row = rows.get(index) ?? {};
    if (match[2] === "id") row.id = Number(value);
    else if (match[2] === "instagram_url") row.instagram_url = String(value);
    else if (value instanceof File) row.image = value;
    rows.set(index, row);
  });
  // An empty link is left out of the form, so a row without one means no link.
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => ({ id: row.id, instagram_url: row.instagram_url ?? "", image: row.image }));
};

/**
 * يحفظ المعرض وصوره. تحديث المعرض على الخادم يتجاهل صفوف الصور، فكل صورة تُحفظ بنقطتها:
 * رابطها أو ملفها الجديد، والصورة المحذوفة من الصفوف تُحذف. إضافة صورة جديدة إلى معرض قائم
 * غير ممكنة بعد، لأن الخادم لا يملك نقطة لها، فتظهر رسالة بدل أن تُفقد الصورة بصمت.
 */
const saveGallery = async (id: number | string, payload: Record<string, unknown> | FormData) => {
  if (!(payload instanceof FormData)) return galleries.update(id, payload);

  const rows = imageRowsOf(payload);
  const saved: (ImageRow & { id: number })[] = [];
  for (const row of rows) {
    if (row.id === undefined) throw new ApiError(i18n.t("galleries.errors.addImage"), { status: 422 });
    saved.push({ ...row, id: row.id });
  }

  const existing = ((await galleries.get(id)).images ?? []) as { id: number; instagram_url?: string | null }[];
  const linkOf = new Map(existing.map((image) => [image.id, image.instagram_url ?? ""]));
  const kept = new Set(saved.map((row) => row.id));

  const fields = new FormData();
  payload.forEach((value, key) => {
    if (!key.startsWith("images[")) fields.append(key, value);
  });
  await galleries.update(id, fields);

  for (const row of saved) {
    if (!row.image && row.instagram_url === (linkOf.get(row.id) ?? "")) continue;
    const form = new FormData();
    if (row.image) form.append("image", row.image);
    form.append("instagram_url", row.instagram_url);
    await galleryImages.updateImage(id, row.id, form);
  }

  for (const image of existing) {
    if (!kept.has(image.id)) await galleryImages.remove(id, image.id);
  }
};

/**
 * المعارض: اسم ووصف بلغتين، وصور متعددة لكل معرض، ولكل صورة رابط انستغرام
 * اختياري. ترسل كـ `FormData` لأن الصور ملفات.
 */
export const galleriesModule = (t: TFunction): CrudModule<Named> => ({
  id: "galleries",
  titleKey: "nav.galleries",
  api: {
    list: galleries.list,
    get: async (id, signal) => withMarketField(await galleries.get(id, signal)),
    create: galleries.create,
    update: saveGallery,
    remove: galleries.remove,
  },
  multipart: true,
  fields: [
    { kind: "bilingual", key: "name", label: t("crud.field.name"), required: true },
    { kind: "bilingual", key: "description", label: t("crud.field.description"), multiline: true },
    {
      kind: "select",
      key: "market",
      label: t("markets.market"),
      options: marketOptions(t, { includeGeneral: true }),
      required: true,
    },
    { kind: "select", key: "layout", label: t("galleries.layout"), options: layoutOptions(t), required: true },
    {
      kind: "rows",
      key: "images",
      requires: "galleries.images.update",
      label: t("crud.field.images"),
      // المفتاح `image` هو ما يتحقق منه الخادم (`images.*.image`)، فلا يُغيَّر إلى اسم آخر.
      columns: [
        { key: "image", label: t("crud.field.image"), kind: "image", ratio: null },
        { key: "instagram_url", label: t("crud.field.instagram"), kind: "text" },
      ],
      newRow: { image: null, instagram_url: "" },
    },
  ],
  columns: [
    {
      key: "cover",
      header: "",
      className: "w-16",
      render: (row) => {
        const images = (row as Record<string, unknown>).images as { url?: string }[] | undefined;
        const url = images?.[0]?.url;
        return url ? (
          <img src={url} alt="" className="size-10 rounded-lg object-cover ring-1 ring-line" />
        ) : (
          <span className="block size-10 rounded-lg bg-canvas ring-1 ring-line" aria-hidden />
        );
      },
    },
    nameColumn<Named>(),
    textColumn<Named>("market_code", t("markets.market"), (row) => (
      <span className="text-ink-soft">{marketCodeOf(row) ?? t("markets.generalShort")}</span>
    )),
    textColumn<Named>("layout", t("galleries.layout"), (row) => {
      const layout = typeof row.layout === "string" ? row.layout : "";
      const known = (GALLERY_LAYOUTS as readonly string[]).includes(layout);
      return <span className="text-ink-soft">{known ? t(`galleries.layouts.${layout}`) : "—"}</span>;
    }),
    textColumn<Named>("images", t("crud.field.images"), (row) => {
      const count = Array.isArray((row as Record<string, unknown>).images)
        ? ((row as Record<string, unknown>).images as unknown[]).length
        : 0;
      return <span className="text-ink-soft tabular-nums">{count}</span>;
    }),
  ],
  filters: [{ key: "market", label: t("markets.market"), options: marketOptions(t, { includeGeneral: true }) }],
  permissions: {
    index: "galleries.index",
    show: "galleries.show",
    create: "galleries.store",
    update: "galleries.update",
    delete: DELETE.map((action) => `galleries.${action}`),
  },
  nameOf: (row, language) => localizedRecord(row, language),
});

/**
 * MYB: قائمة مكونات «اصنع بيرغرك». تستعمل خدمات المكونات نفسها، لكن بصلاحيات
 * وعنوان مستقلين كما في الأصلي.
 */
export const mybModule = (t: TFunction): CrudModule<Named> => ({
  ...ingredientsModule(t),
  id: "myb",
  titleKey: "nav.myb",
  api: {
    list: ingredients.list,
    get: ingredients.get,
    create: ingredients.create,
    update: ingredients.update,
    remove: ingredients.remove,
  },
  permissions: {
    index: "mybs.index",
    show: "mybs.show",
    create: "mybs.create",
    update: "mybs.update",
    delete: DELETE.map((action) => `mybs.${action}`),
  },
});
