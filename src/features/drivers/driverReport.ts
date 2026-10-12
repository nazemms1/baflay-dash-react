import type { currentLanguage } from "@/i18n";
import { asArray, asRecord, toNumber, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";

/**
 * صف سائق في حساب السائقين أو في ملخص السائق. الأرقام نفسها في الشاشتين، لأن الخادم
 * يبنيهما من الكود نفسه.
 */
export interface AccountRow {
  driverId: string;
  driverName: string;
  currency: string;
  cashToHandIn: number;
  cashInTransit: number;
  failedCash: number;
  failedCardOrders: number;
  delivered: number;
  failed: number;
  outNow: number;
  assigned: number;
}

export interface BranchAccounts {
  key: string;
  branchName: string;
  currency: string;
  drivers: AccountRow[];
}

type Language = ReturnType<typeof currentLanguage>;

/** صف سائق واحد بأسماء حقول الخادم كما في الوثيقة. */
export function toAccountRow(raw: unknown): AccountRow {
  const record = asRecord(raw);
  const driver = asRecord(record.driver);
  const driverId = toText(record.driver_id ?? driver.id);
  return {
    driverId,
    driverName: toText(driver.name) || toText(record.driver_name) || (driverId ? `#${driverId}` : "—"),
    currency: toText(record.currency),
    cashToHandIn: toNumber(record.cash_to_hand_in),
    cashInTransit: toNumber(record.cash_in_transit),
    failedCash: toNumber(record.failed_cash),
    failedCardOrders: toNumber(record.failed_card_orders),
    delivered: toNumber(record.delivered),
    failed: toNumber(record.failed),
    outNow: toNumber(record.out_now),
    assigned: toNumber(record.assigned),
  };
}

/**
 * حساب السائقين مجمّعاً حسب الفرع. يقبل شكلين: فرع ومعه `drivers`، أو صف لكل سائق ومعه فرعه.
 * لا يُجمع شيء بين الفروع، فلكل فرع مجموعته.
 */
export function toBranchAccounts(body: unknown, language: Language, fallbackName: string): BranchAccounts[] {
  const root = asRecord(body);
  // `totals` صفوف سائقين بلا معلومات فرع، فتُجمع في مجموعة واحدة باسم `fallbackName`.
  const entries: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray(root.branches)
      ? root.branches
      : asArray(root.totals);
  const groups = new Map<string, BranchAccounts>();

  const groupFor = (record: Record<string, unknown>): BranchAccounts => {
    const branch = asRecord(record.branch);
    const key = toText(record.branch_id ?? branch.id, "0");
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        branchName: localizedRecord(branch, language) || toText(record.branch_name) || (key === "0" ? fallbackName : `#${key}`),
        currency: toText(record.currency ?? branch.currency),
        drivers: [],
      };
      groups.set(key, group);
    }
    return group;
  };

  for (const entry of entries) {
    const record = asRecord(entry);
    if (Array.isArray(record.drivers)) {
      groupFor(record).drivers.push(...record.drivers.map(toAccountRow));
    } else {
      groupFor(record).drivers.push(toAccountRow(record));
    }
  }

  return [...groups.values()];
}

/**
 * ملخص السائق كما يرسله الخادم: `data.totals` فيه صف لكل عملة. لا يُجمع المال بين العملات،
 * فيبقى كل صف على حدة. ليس للسائق طلبات اليوم فلا صفوف، ويعود صف صفري.
 */
export function toDriverSummary(raw: unknown): AccountRow[] {
  const record = asRecord(raw);
  const totals = asArray(record.totals);
  if (totals.length > 0) return totals.map(toAccountRow);
  return [toAccountRow(record)];
}

/** اليوم المحلي بصيغة `YYYY-MM-DD`، وهي صيغة الخادم في فلتر التاريخ. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
