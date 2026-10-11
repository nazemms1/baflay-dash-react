import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CircleUserRound, Clock3, TriangleAlert } from "lucide-react";
import { LocationPicker } from "@/components/map/LocationPicker";
import { ReleasedValue } from "@/components/ui/ReleasedValue";
import { toNullableNumber, toText } from "@/lib/coerce";
import { formatDateTime } from "@/lib/format";
import { users, type Named } from "@/services";
import { BranchName } from "./BranchName";
import { userEmail, userPhone, userUsername } from "./released";

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

/** الحقول التي يطابق بها حساب سابق هذا الحساب، بمفاتيح الخادم وتسمياتها الظاهرة. */
const MATCH_LABEL_KEYS: Record<string, string> = {
  email: "crud.field.email",
  phone: "crud.field.phone",
  username: "common.username",
};

/**
 * تفاصيل المستخدم كاملة: الصورة والاسم وأسماء الدخول والبريد والهاتف والفرع وتاريخ الإنشاء،
 * والموقع على الخريطة إن وُجد. ثم ما يلزم المشغّل معرفته: تحذير إن كان الحساب لا يستطيع أحد
 * الدخول إليه، وحسابات محذوفة طابقت بريده أو هاتفه المُطلَقين فلها طلبات أو تاريخ.
 */
export function UserDetails({ record }: { record: Named }) {
  const { t } = useTranslation();
  const row = record as unknown as Record<string, unknown>;

  const context = useQuery({
    queryKey: ["user-context", record.id],
    queryFn: ({ signal }) => users.context(record.id, signal),
  });
  const previousAccounts = context.data?.previousAccounts ?? [];

  const username = userUsername(row);
  const email = userEmail(row);
  const phone = userPhone(row);
  const picture = typeof row.picture === "string" && row.picture ? row.picture : null;

  const unreachable = row.can_sign_in === false && !row.deleted_at;

  // الخادم يحفظ خط العرض في `location_x` وخط الطول في `location_y`، كما في الفروع.
  const lat = toNullableNumber(row.location_x);
  const lng = toNullableNumber(row.location_y);
  const hasLocation = lat !== null && lng !== null;

  const matchedLabel = (matched: string[] | undefined) => {
    const names = (matched ?? []).map((key) => (MATCH_LABEL_KEYS[key] ? t(MATCH_LABEL_KEYS[key]) : key));
    return names.length ? names.join(t("users.andSeparator")) : t("users.oneIdentifier");
  };

  return (
    <div className="space-y-6">
      {unreachable && (
        <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm leading-7 text-warn">
          <TriangleAlert className="mt-1 size-4 shrink-0" aria-hidden />
          {t("users.unreachableBanner")}
        </p>
      )}

      {previousAccounts.map((account) => (
        <p key={account.id} className="flex items-start gap-2 rounded-xl bg-canvas px-4 py-3 text-sm leading-7 text-ink-soft">
          <Clock3 className="mt-1 size-4 shrink-0 text-muted" aria-hidden />
          <span>
            {t("users.belongedToDeleted", { matched: matchedLabel(account.matched_on) })} «{account.name}» (#{account.id}){" "}
            {account.orders_count
              ? t("users.ownerOfOrders", { count: account.orders_count })
              : t("users.noOrders")}
          </span>
        </p>
      ))}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-canvas ring-1 ring-line">
          {picture ? (
            <img src={picture} alt="" className="size-full object-cover" />
          ) : (
            <CircleUserRound className="size-12 text-muted" aria-hidden />
          )}
        </div>

        <dl className="grid flex-1 gap-4 sm:grid-cols-2">
          <Tile label={t("crud.field.name")}>{toText(row.name) || "—"}</Tile>
          <Tile label={t("common.username")}>
            <ReleasedValue value={username.value} wasReleased={username.wasReleased} dir="ltr" />
          </Tile>
          <Tile label={t("crud.field.email")}>
            <ReleasedValue value={email.value} wasReleased={email.wasReleased} dir="ltr" />
          </Tile>
          <Tile label={t("crud.field.phone")}>
            <ReleasedValue value={phone.value} wasReleased={phone.wasReleased} dir="ltr" />
          </Tile>
          <Tile label={t("crud.field.branch")}>
            <BranchName branchId={row.branch_id} branch={row.branch} />
          </Tile>
          <Tile label={t("common.createdAt")}>
            <span className="tabular-nums">{formatDateTime(toText(row.created_at) || null)}</span>
          </Tile>
        </dl>
      </div>

      {hasLocation && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink-soft">{t("users.userLocation")}</p>
          <LocationPicker lat={lat} lng={lng} readOnly height="16rem" />
        </div>
      )}
    </div>
  );
}
