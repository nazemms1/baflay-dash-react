import type { TFunction } from "i18next";
import type { CrudModule } from "@/components/crud/types";
import { localizedRecord } from "@/lib/localized";
import type { Option } from "@/components/ui/Fields";
import { GENERAL_MARKET, marketOptions } from "@/features/markets/marketOptions";
import { galleries, ingredients, type Named } from "@/services";
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
    update: galleries.update,
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
