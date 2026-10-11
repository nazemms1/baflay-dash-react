import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { CrudModule } from "@/components/crud/types";
import { toPage } from "@/lib/http/envelope";
import { formatDateTime, formatNumber } from "@/lib/format";
import { gameDashboard, type Named } from "@/services";
import { textColumn } from "./shared";

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const rec = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** المناطق التي تُصفّى بها قائمة اللاعبين، كما في الداشبورد القديم. */
const REGIONS = ["Iraq", "Syria", "UAE"] as const;

interface GameLog {
  score?: unknown;
  floor?: unknown;
  date?: unknown;
}

/** تفاصيل اللاعب: بياناته ثم سجل ألعابه، بتسميات الواجهة الحالية. */
function PlayerDetails({ record }: { record: Named }) {
  const { t } = useTranslation();
  const games = Array.isArray(record.games) ? (record.games as GameLog[]) : [];

  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs text-muted">{t("game.detail.name")}</dt><dd className="mt-1 font-medium">{str(record.name) || "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("game.detail.email")}</dt><dd className="mt-1" dir="ltr">{str(record.email) || "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("game.detail.branch")}</dt><dd className="mt-1">{str(rec(record.branch).name) || str(record.branch) || "—"}</dd></div>
        <div><dt className="text-xs text-muted">{t("game.highScore")}</dt><dd className="mt-1 font-semibold tabular-nums">{formatNumber(Number(record.high_score ?? 0))}</dd></div>
      </dl>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[360px] text-sm">
          <thead className="bg-secondary text-xs font-semibold text-surface">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">{t("game.score")}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t("game.floor")}</th>
              <th className="px-4 py-2.5 text-start font-medium">{t("common.date")}</th>
            </tr>
          </thead>
          <tbody>
            {games.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted">{t("game.noGames")}</td></tr>
            )}
            {games.map((game, index) => (
              <tr key={index} className="border-t border-line">
                <td className="px-4 py-2.5 tabular-nums">{str(game.score) || "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">{str(game.floor) || "—"}</td>
                <td className="px-4 py-2.5 text-muted">{formatDateTime(str(game.date) || null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * لعبة الداشبورد: قائمة اللاعبين مع تصفية بالمنطقة والفترة، والحذف، وعرض تفاصيل كل لاعب
 * وسجل ألعابه. القائمة لا ترقّم من الخادم، فتُعرض كاملة كما يعيدها بعد التصفية.
 */
export const gameModule = (t: TFunction): CrudModule<Named> => ({
  id: "game-dashboard",
  titleKey: "nav.game",
  api: {
    // CrudPage يمرر المرشّحات مع الاستعلام: المنطقة والفترة تذهب إلى الخادم كما هي.
    list: async (query) => {
      const filters = query as unknown as Record<string, string | undefined>;
      return toPage<Named>(
        await gameDashboard.overview({
          branch: filters.branch || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        })
      );
    },
    get: async (id) => {
      const body = rec(await gameDashboard.player(id));
      const player = rec(body.player);
      return { ...player, id: (player.id as number | string | undefined) ?? id, games: body.games ?? [] } as Named;
    },
    remove: (id) => gameDashboard.removePlayer(id),
  },
  fields: [],
  filters: [
    {
      key: "branch",
      label: t("crud.field.branch"),
      options: REGIONS.map((value) => ({ value, label: t(`game.regions.${value}`) })),
    },
    { key: "from", label: t("game.from"), kind: "date" },
    { key: "to", label: t("game.to"), kind: "date" },
  ],
  details: PlayerDetails,
  columns: [
    textColumn<Named>("name", t("crud.field.name")),
    textColumn<Named>("email", t("crud.field.email")),
    textColumn<Named>("branch", t("crud.field.branch"), (row) => (
      <span className="text-ink-soft">{str(rec(row.branch).name) || str(row.branch) || "—"}</span>
    )),
    textColumn<Named>("total_games", t("game.gamesCount")),
    textColumn<Named>("high_score", t("game.highScore")),
    {
      key: "date",
      header: t("common.date"),
      render: (row) => <span className="text-xs text-muted">{formatDateTime(str(row.created_at) || null)}</span>,
    },
  ],
  permissions: {
    // الصلاحية الوحيدة للعبة على المنصة هي حذف اللاعبين، فالشاشة تُحرس بها.
    index: "game.players.delete",
    show: "game.players.delete",
    delete: ["game.players.delete"],
  },
  nameOf: (row) => str(row.name) || `#${row.id}`,
});
