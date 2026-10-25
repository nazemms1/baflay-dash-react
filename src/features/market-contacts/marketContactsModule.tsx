import type { TFunction } from "i18next";
import type { CrudModule } from "@/components/crud/types";
import type { CountryScope } from "@/features/markets/countryScope";
import { ApiError } from "@/lib/http/errors";
import { marketContacts, type MarketContact, type MarketContactPayload } from "@/services";
import { ContactDetails } from "./ContactDetails";
import { makeContactForm } from "./ContactForm";
import { makeContactRowActions } from "./ContactRowActions";
import { sortContacts } from "./contactRules";

/**
 * وحدة وسائل التواصل لدولة واحدة. `scope.code` هو رمز الدولة (`SY`)، ومعرّف الوحدة يحمله أيضاً،
 * فكاش كل دولة منفصل ولا يختلط بيانات دولتين. النموذج والتفاصيل مخصصان، لأن الحقول تتغير حسب النوع.
 */
export const marketContactsModule = (t: TFunction, scope: CountryScope): CrudModule<MarketContact> => {
  const moduleId = `market-contacts-${scope.code}`;

  return {
    id: moduleId,
    titleKey: "nav.marketContacts",
    api: {
      list: async () => {
        const items = sortContacts(await marketContacts.list(scope.code));
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
        const found = (await marketContacts.list(scope.code)).find((contact) => String(contact.id) === String(id));
        if (!found) throw new ApiError("Not found", { status: 404 });
        return found;
      },
      create: (payload) => marketContacts.create(scope.code, payload as unknown as MarketContactPayload),
      update: (id, payload) => marketContacts.update(scope.code, id, payload as unknown as MarketContactPayload),
      remove: (id) => marketContacts.remove(scope.code, id),
    },
    // الحقول لا تُستعمل: النموذج والتفاصيل مخصصان، فيكفي ألا تكون وحدها فارغة في النوع.
    fields: [],
    columns: [
      {
        key: "type",
        header: t("marketContacts.type"),
        render: (row) => (
          <span className="text-sm font-medium text-ink">
            {row.type === "social" && row.platform
              ? t(`marketContacts.platforms.${row.platform}`)
              : t(`marketContacts.types.${row.type}`)}
          </span>
        ),
      },
      {
        key: "label",
        header: t("marketContacts.labelEn"),
        render: (row) => <span className="text-ink">{row.label}</span>,
      },
      {
        key: "value",
        header: t("marketContacts.value"),
        render: (row) => (
          <span dir="ltr" className="line-clamp-1 max-w-md break-all text-ink-soft">
            {row.value}
          </span>
        ),
      },
      {
        key: "status",
        header: t("marketContacts.status"),
        render: (row) => (
          <span className="text-sm text-ink-soft">
            {row.is_active ? t("marketContacts.live") : t("marketContacts.inactive")}
          </span>
        ),
      },
    ],
    permissions: {
      index: "markets.contacts.index",
      create: "markets.contacts.store",
      update: "markets.contacts.update",
      delete: ["markets.contacts.destroy"],
    },
    nameOf: (row) => row.label || row.value,
    form: makeContactForm(scope, moduleId),
    details: ContactDetails,
    rowActions: makeContactRowActions(scope.code, moduleId),
  };
};
