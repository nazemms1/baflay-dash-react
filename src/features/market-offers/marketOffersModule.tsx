import type { TFunction } from "i18next";
import type { CrudModule } from "@/components/crud/types";
import type { CountryScope } from "@/features/markets/countryScope";
import { ApiError } from "@/lib/http/errors";
import { marketOffers, type MarketOffer } from "@/services";
import { makeOfferForm } from "./OfferForm";
import { OfferDetails } from "./OfferDetails";
import { makeOfferRowActions } from "./OfferRowActions";
import { sortOffers } from "./offerRules";

/**
 * وحدة عروض دولة واحدة. `scope.code` هو رمز الدولة (`SY`)، ومعرّف الوحدة يحمله أيضاً، فكاش كل دولة
 * منفصل. النموذج والتفاصيل مخصصان لأن العرض صورة ورابط لا اسم له.
 */
export const marketOffersModule = (t: TFunction, scope: CountryScope): CrudModule<MarketOffer> => {
  const moduleId = `market-offers-${scope.code}`;

  return {
    id: moduleId,
    titleKey: "nav.marketOffers",
    api: {
      list: async () => {
        const items = sortOffers(await marketOffers.list(scope.code));
        return {
          items,
          meta: {
            total: items.length,
            currentPage: 1,
            lastPage: 1,
            perPage: Math.max(items.length, 1),
          },
        };
      },
      get: async (id) => {
        const found = (await marketOffers.list(scope.code)).find((offer) => String(offer.id) === String(id));
        if (!found) throw new ApiError("Not found", { status: 404 });
        return found;
      },
      create: (payload) => marketOffers.create(scope.code, payload as FormData),
      update: async (id, payload) =>
        payload instanceof FormData
          ? marketOffers.updateWithImage(id, payload)
          : marketOffers.updateLink(id, (payload.link as string | null) ?? null),
      remove: (id) => marketOffers.remove(id),
    },
    // الحقول لا تُستعمل هنا: النموذج والتفاصيل مخصصان، فالقائمة الفارغة تكفي للنوع.
    fields: [],
    columns: [
      {
        key: "image",
        header: "",
        className: "w-16",
        render: (row) => (
          <img src={row.image} alt="" className="h-10 w-16 rounded-lg object-cover ring-1 ring-line" />
        ),
      },
      {
        key: "link",
        header: t("marketOffers.link"),
        render: (row) => (
          <span dir="ltr" className="line-clamp-1 max-w-md break-all text-start text-ink-soft">
            {row.link || "—"}
          </span>
        ),
      },
    ],
    permissions: {
      index: "markets.offers.index",
      create: "markets.offers.store",
      update: "markets.offers.update",
      delete: ["markets.offers.destroy"],
    },
    // التعديل والحذف يظهران لكل من يرى الصفحة، والخادم يرفض ما لا تملك صلاحيته.
    showWithoutPermission: ["update", "delete"],
    nameOf: (row) => row.link || `#${row.id}`,
    form: makeOfferForm(scope.code, moduleId),
    details: OfferDetails,
    rowActions: makeOfferRowActions(scope.code, moduleId),
  };
};
