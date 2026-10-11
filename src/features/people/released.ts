import { toText } from "@/lib/coerce";

/**
 * قيمة حقل قد يكون أُطلق: الحيّة إن وُجدت، وإلا السابقة، مع العلم بأنها سابقة كي تُعرض بشارة
 * «سابقاً» فلا تُقرأ بريداً حيّاً يمكن مراسلته. ومفاتيح `former_*` غائبة عن الحساب الحيّ
 * لا فارغة، فالفحص هنا يكفي بقيمة النص وحدها.
 */
export interface ReleasedField {
  value: string | null;
  wasReleased: boolean;
}

export function releasedField(live: unknown, former: unknown): ReleasedField {
  const liveText = toText(live);
  if (liveText) return { value: liveText, wasReleased: false };
  const formerText = toText(former);
  if (formerText) return { value: formerText, wasReleased: true };
  return { value: null, wasReleased: false };
}

export const userEmail = (user: Record<string, unknown>) => releasedField(user.email, user.former_email);
export const userPhone = (user: Record<string, unknown>) => releasedField(user.phone, user.former_phone);
export const userUsername = (user: Record<string, unknown>) => releasedField(user.username, user.former_username);
