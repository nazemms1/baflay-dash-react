import type { TFunction } from "i18next";
import type { CrudModule } from "@/components/crud/types";
import { localizedRecord } from "@/lib/localized";
import { galleries, ingredients, type Named } from "@/services";
import { nameColumn, textColumn } from "./shared";
import { ingredientsModule } from "./catalog";

const DELETE = ["destroy", "delete"] as const;

/**
 * المعارض: اسم ووصف بلغتين، وصور متعددة لكل معرض، ولكل صورة رابط انستغرام
 * اختياري. ترسل كـ `FormData` لأن الصور ملفات.
 */
export const galleriesModule = (t: TFunction): CrudModule<Named> => ({
  id: "galleries",
  titleKey: "nav.galleries",
  api: {
    list: galleries.list,
    get: galleries.get,
    create: galleries.create,
    update: galleries.update,
    remove: galleries.remove,
  },
  multipart: true,
  fields: [
    { kind: "bilingual", key: "name", label: t("crud.field.name"), required: true },
    { kind: "bilingual", key: "description", label: t("crud.field.description"), multiline: true },
    {
      kind: "rows",
      key: "images",
      requires: "galleries.images.update",
      label: t("crud.field.images"),
      columns: [
        { key: "file", label: t("crud.field.image"), kind: "image", ratio: null },
        { key: "instagram_url", label: t("crud.field.instagram"), kind: "text" },
      ],
      newRow: { file: null, instagram_url: "" },
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
    textColumn<Named>("images", t("crud.field.images"), (row) => {
      const count = Array.isArray((row as Record<string, unknown>).images)
        ? ((row as Record<string, unknown>).images as unknown[]).length
        : 0;
      return <span className="text-ink-soft tabular-nums">{count}</span>;
    }),
  ],
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
