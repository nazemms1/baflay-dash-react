import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { TFunction } from "i18next";
import { CrudPage } from "@/components/crud/CrudPage";
import type { CrudModule } from "@/components/crud/types";
import { SelectField } from "@/components/ui/Fields";
import { PageLoader } from "@/components/ui/PageLoader";
import { currentLanguage } from "@/i18n";
import { localizedRecord } from "@/lib/localized";
import { countries, listAll } from "@/services";
import { codeOf, scopeOf, type CountryScope } from "./countryScope";

interface CountryScopedPageProps<T extends { id: number | string }> {
  /** يبني وحدة CRUD لدولة. يجب أن تكون دالة ثابتة في الوحدة، وإلا تُعاد بناء النماذج مع كل رسم. */
  build: (t: TFunction, scope: CountryScope) => CrudModule<T>;
  countryLabel: string;
  emptyText: string;
}

/**
 * شاشة تختار الدولة من القائمة، فتعرض وحدة CRUD لها وحدها. الدول بلا رمز لا تظهر لأن محتواها
 * لا يُربط بدولة بعد. الدولة المختارة في الرابط، فالتحديث والرجوع يبقيانها.
 */
export function CountryScopedPage<T extends { id: number | string }>({
  build,
  countryLabel,
  emptyText,
}: CountryScopedPageProps<T>) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const pool = useQuery({
    queryKey: ["countries", "scope-picker"],
    queryFn: ({ signal }) => listAll((query, requestSignal) => countries.list(query, requestSignal), signal),
  });

  const withCode = useMemo(
    () => (pool.data ?? []).filter((country) => codeOf(country) !== ""),
    [pool.data],
  );

  const selected = useMemo(
    () => withCode.find((country) => String(country.id) === params.get("country")) ?? withCode[0] ?? null,
    [withCode, params],
  );

  const module = useMemo(
    () => (selected ? build(t as unknown as TFunction, scopeOf(selected)) : null),
    [t, build, selected],
  );

  if (pool.isPending) return <PageLoader />;

  if (withCode.length === 0 || !selected) {
    return <p className="text-sm text-ink-soft">{emptyText}</p>;
  }

  const language = currentLanguage();

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <SelectField
          label={countryLabel}
          value={selected.id}
          onChange={(value) => setParams({ country: String(value) }, { replace: true })}
          options={withCode.map((country) => ({
            value: country.id,
            label: `${localizedRecord(country, language)} · ${codeOf(country)}`,
          }))}
        />
      </div>
      {module && <CrudPage key={module.id} module={module} />}
    </div>
  );
}
