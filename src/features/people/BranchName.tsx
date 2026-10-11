import { useQuery } from "@tanstack/react-query";
import { currentLanguage } from "@/i18n";
import { asRecord, toNumber } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { branches } from "@/services";

/**
 * اسم الفرع بدل رقمه. إن جاء الفرع كاملاً مع السجل نعرضه مباشرة، وإلا نجلب هذا الفرع وحده
 * بمعرّفه، فلا تُنزَّل قائمة الفروع كلها لعرض اسم واحد في كل صف.
 */
export function BranchName({ branchId, branch }: { branchId: unknown; branch: unknown }) {
  const language = currentLanguage();
  const nestedName = typeof branch === "string" ? branch : localizedRecord(asRecord(branch), language);
  const id = toNumber(branchId);
  const needsLookup = !nestedName && id > 0;

  const found = useQuery({
    queryKey: ["branch-name", id],
    queryFn: ({ signal }) => branches.get(id, signal),
    enabled: needsLookup,
    staleTime: 5 * 60_000,
  });

  if (nestedName) return <>{nestedName}</>;
  if (!needsLookup) return <>—</>;

  return <>{found.data ? localizedRecord(found.data, language) || `#${id}` : "—"}</>;
}
