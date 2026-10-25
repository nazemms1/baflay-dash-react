import type { TFunction } from "i18next";
import type { CrudModule } from "@/components/crud/types";
import type { Page } from "@/lib/http/envelope";
import { ApiError } from "@/lib/http/errors";
import { heroSlides, type HeroSlide } from "@/services";
import { makeHeroSlideForm } from "./HeroSlideForm";
import { makeHeroSlideRowActions } from "./HeroSlideRowActions";
import { sortSlides } from "./slides";

/** حالة الشريحة في القائمة: مفعّلة تظهر للزوار، أو متوقفة لا تظهر. */
const statusOf = (slide: HeroSlide, t: TFunction): string =>
  slide.is_active ? t("heroSlides.live") : t("heroSlides.inactive");

/**
 * وحدة شرائح الواجهة الرئيسية لدولة واحدة. `code` هو رمز الدولة (`SY`)، ومعرّف الوحدة يحمله
 * أيضاً، فكاش كل دولة منفصل ولا يختلط بيانات دولتين.
 */
export const heroSlidesModule = (t: TFunction, code: string): CrudModule<HeroSlide> => {
  const moduleId = `hero-slides-${code}`;

  return {
    id: moduleId,
    titleKey: "nav.heroSlides",
    api: {
      list: async () => {
        const items = sortSlides(await heroSlides.list(code));
        const meta: Page<HeroSlide>["meta"] = {
          total: items.length,
          currentPage: 1,
          lastPage: 1,
          perPage: Math.max(items.length, 1),
        };
        return { items, meta };
      },
      get: async (id) => {
        const found = (await heroSlides.list(code)).find((slide) => String(slide.id) === String(id));
        if (!found) throw new ApiError("Not found", { status: 404 });
        return found;
      },
      create: (payload) => heroSlides.create(code, payload as FormData),
      update: (id, payload) => heroSlides.update(id, payload as FormData),
      remove: (id) => heroSlides.remove(id),
    },
    fields: [
      { kind: "bilingual", key: "title", label: t("heroSlides.title"), required: true },
      { kind: "bilingual", key: "subtitle", label: t("heroSlides.subtitle") },
      { kind: "image", key: "desktop_image", label: t("heroSlides.desktopImage"), ratio: 16 / 9 },
      { kind: "image", key: "mobile_image", label: t("heroSlides.mobileImage"), ratio: null },
      { kind: "switch", key: "is_active", label: t("heroSlides.active") },
    ],
    columns: [
      {
        key: "image",
        header: "",
        className: "w-16",
        render: (row) => (
          <img src={row.desktop_image} alt="" className="size-10 rounded-lg object-cover ring-1 ring-line" />
        ),
      },
      {
        key: "title",
        header: t("heroSlides.title"),
        render: (row) => <span className="font-medium text-ink">{row.title_ar || row.title || "—"}</span>,
      },
      {
        key: "status",
        header: t("heroSlides.status"),
        render: (row) => <span className="text-sm text-ink-soft">{statusOf(row, t)}</span>,
      },
    ],
    permissions: {
      index: "markets.hero.slides.index",
      create: "markets.hero.slides.store",
      update: "hero.slides.update",
      delete: ["hero.slides.destroy"],
    },
    multipart: true,
    nameOf: (row) => row.title_ar || row.title || "",
    form: makeHeroSlideForm(code, moduleId),
    rowActions: makeHeroSlideRowActions(code, moduleId),
  };
};
