import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MarketContact } from "@/services";

/**
 * تفاصيل وسيلة التواصل بتسميات مترجمة، لأن النوع والمنصة قيم داخلية كـ`social` و`x`. الرابط يظهر
 * كما يصل الزائر إليه، والعنوان وساعات العمل بنسختيهما.
 */
export function ContactDetails({ record }: { record: MarketContact }) {
  const { t } = useTranslation();

  const typeText =
    record.type === "social" && record.platform
      ? t(`marketContacts.platforms.${record.platform}`)
      : t(`marketContacts.types.${record.type}`);

  const rows: [string, ReactNode][] = [
    [t("marketContacts.type"), typeText],
    [t("marketContacts.labelEn"), record.label],
    [t("marketContacts.labelAr"), record.label_ar ?? "—"],
    [t("marketContacts.value"), <span dir="ltr">{record.value}</span>],
    [t("marketContacts.valueAr"), record.value_ar ?? "—"],
    [
      t("marketContacts.link"),
      record.link ? (
        <a href={record.link} target="_blank" rel="noreferrer" dir="ltr" className="text-primary underline">
          {record.link}
        </a>
      ) : (
        "—"
      ),
    ],
    [t("marketContacts.status"), record.is_active ? t("marketContacts.live") : t("marketContacts.inactive")],
  ];

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-sm text-ink-soft">{label}</dt>
          <dd className="mt-1 break-all text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
