import { useQuery } from "@tanstack/react-query";
import { currentLanguage } from "@/i18n";
import { asRecord, toNumber } from "@/lib/coerce";
import { localizedRecord, type RawBilingual } from "@/lib/localized";
import { countries, states } from "@/services";

/**
 * الولاية والبلد معاً في خلية واحدة: «سوريا · دمشق». الخادم يرسل معرّف الولاية فقط،
 * فالاسم يُقرأ من قائمة الولايات، والبلد من الولاية نفسها. تستعمل المفاتيح نفسها
 * لنموذج المدينة، فالقائمتان تُجلبان مرة واحدة.
 */
export function CityStateCell({ row }: { row: Record<string, unknown> }) {
  const language = currentLanguage();
  const stateId = toNumber(row.state_id ?? asRecord(row.state).id) || null;

  const stateList = useQuery({
    queryKey: ["options", "states"],
    queryFn: async ({ signal }) => (await states.list({ page: 1, per_page: 500 }, signal)).items,
    staleTime: 60_000,
  });
  const countryList = useQuery({
    queryKey: ["options", "countries"],
    queryFn: async ({ signal }) => (await countries.list({ page: 1, per_page: 500 }, signal)).items,
    staleTime: 60_000,
  });

  if (stateId === null) return <span className="text-muted">—</span>;

  const state = stateList.data?.find((item) => toNumber(item.id) === stateId);
  if (!state) return <span className="text-ink-soft">#{stateId}</span>;

  const country = countryList.data?.find((item) => toNumber(item.id) === toNumber(state.country_id));
  const countryName = localizedRecord(country, language);
  const stateName = localizedRecord(state, language);

  return <span className="text-ink-soft">{[countryName, stateName].filter(Boolean).join(" · ")}</span>;
}

/**
 * فروع المدينة كما يرسلها الخادم في القائمة نفسها: كل فرع شارة باسمه، ومعها عددها
 * ليُعرف من الجدول دون فتح المدينة.
 */
export function CityBranchesCell({ row }: { row: Record<string, unknown> }) {
  const language = currentLanguage();
  const branches = Array.isArray(row.branches) ? (row.branches as (RawBilingual & { id?: unknown })[]) : [];

  if (branches.length === 0) return <span className="text-muted">—</span>;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-full bg-primary-soft px-2 text-xs font-semibold tabular-nums text-ink">
        {branches.length}
      </span>
      {branches.map((branch) => (
        <span
          key={String(branch.id)}
          className="rounded-full bg-canvas px-2.5 py-0.5 text-xs text-ink-soft ring-1 ring-line"
        >
          {localizedRecord(branch, language) || `#${String(branch.id)}`}
        </span>
      ))}
    </div>
  );
}
