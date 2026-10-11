import { asArray, asRecord, toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { api } from "@/lib/http/client";
import { ApiError } from "@/lib/http/errors";
import { unwrapData } from "@/lib/http/envelope";
import i18n from "@/i18n";
import type { AbilityRule, SessionUser } from "./types";

function toAbilityRule(raw: unknown): AbilityRule {
  const rule = asRecord(raw);
  return {
    name: typeof rule.name === "string" ? rule.name : undefined,
    action: typeof rule.action === "string" ? rule.action : undefined,
    subject: typeof rule.subject === "string" ? rule.subject : undefined,
  };
}

/**
 * الخادم يعيد الفرع أحياناً نصاً جاهزاً ("Damascus - Mezzeh") وأحياناً كائناً.
 * نقبل الشكلين ونحوّلهما إلى كائن واحد، فلا تعتمد الشاشات على أيّهما.
 */
function toBranch(raw: unknown): SessionUser["branch"] {
  if (typeof raw === "string") {
    return raw ? { name: raw, nameAr: raw } : null;
  }
  const branch = asRecord(raw);
  if (!branch.name && !branch.name_ar) return null;
  return { name: toText(branch.name), nameAr: toText(branch.name_ar) };
}

/** الأدوار قد تأتي نصوصاً («Supervisor») أو كائنات فيها الاسم أو التسمية. */
function toRoles(raw: unknown): string[] {
  return asArray(raw)
    .map((role) => (typeof role === "string" ? role : toText(asRecord(role).label) || toText(asRecord(role).name)))
    .filter((role) => role !== "");
}

export function toSessionUser(raw: unknown): SessionUser {
  const user = asRecord(raw);
  return {
    id: toNumber(user.id),
    name: toText(user.name),
    email: toText(user.email),
    isStaff: user.is_staff === true,
    branchId: toNullableNumber(user.branch_id),
    branch: toBranch(user.branch),
    abilityRules: asArray(user.abilityRules).map(toAbilityRule),
    roles: toRoles(user.roles),
  };
}

export interface LoginResult {
  token: string;
  user: SessionUser | null;
}

/** `remember`: هل تبقى الجلسة 30 يوماً على الجهاز، كما في الداشبورد القديم (الافتراضي نعم). */
export async function login(email: string, password: string, remember = true): Promise<LoginResult> {
  // silentError: خطأ كلمة المرور يظهر داخل النموذج، لا كإشعار عام.
  const { data } = await api.post("users/login", { email, password, remember }, { silentError: true });
  const body = asRecord(data);
  const token = body.token ?? body.AccessToken;

  if (typeof token !== "string" || !token) {
    throw new ApiError(i18n.t("errors.unexpected"));
  }

  return {
    token,
    user: body.user ? toSessionUser(body.user) : null,
  };
}

export async function profile(): Promise<SessionUser> {
  const { data } = await api.get("users/profile");
  return toSessionUser(unwrapData(data));
}

export async function logout(): Promise<void> {
  await api.post("users/logout");
}
