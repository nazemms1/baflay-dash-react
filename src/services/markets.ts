import { api } from "@/lib/http/client";
import { unwrapData } from "@/lib/http/envelope";
import type { Id } from "./resource";

/** شريحة الواجهة الرئيسية لدولة، كما تعيدها لوحة التحكم (تشمل المتوقفة والمجدولة). */
export interface HeroSlide {
  id: number;
  sort_order: number;
  desktop_image: string;
  /** `null` يعني أن صورة الكمبيوتر تُستعمل على الجوال أيضاً. */
  mobile_image: string | null;
  title: string | null;
  title_ar: string | null;
  subtitle: string | null;
  subtitle_ar: string | null;
  /** YYYY-MM-DD HH:mm أو `null` لعرض دائم. */
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  /** هل يراها الزائر الآن، أي مفعّلة وضمن وقت العرض. */
  is_showing_now: boolean;
}

/**
 * شرائح الواجهة الرئيسية لكل دولة. الدولة تُعرَّف برمزها (`SY`)، والخادم يقبل أي حالة أحرف.
 * الرفع يُرسل كـ `FormData`، والتعديل بالملف يتبع ما يقبله الخادم: `POST` مع `_method=PUT`.
 */
export const heroSlides = {
  /** الخادم يعيد `{ data: { market, slides: [...] } }` وليس قائمة مرقّمة. */
  async list(code: string): Promise<HeroSlide[]> {
    const { data } = await api.get<{ data?: { slides?: HeroSlide[] } }>(
      `/markets/${encodeURIComponent(code)}/hero-slides`,
    );
    return data.data?.slides ?? [];
  },

  create(code: string, payload: FormData): Promise<unknown> {
    return api
      .post(`/markets/${encodeURIComponent(code)}/hero-slides`, payload)
      .then((response) => response.data as unknown);
  },

  update(id: Id, payload: FormData): Promise<unknown> {
    payload.set("_method", "PUT");
    return api.post(`/hero-slides/${id}`, payload).then((response) => response.data as unknown);
  },

  remove(id: Id): Promise<unknown> {
    return api.delete(`/hero-slides/${id}`).then((response) => response.data as unknown);
  },

  /** يرسل كل شرائح الدولة بالترتيب الجديد، وإلا رفض الخادم الطلب. */
  reorder(code: string, slideIds: number[]): Promise<unknown> {
    return api
      .put(`/markets/${encodeURIComponent(code)}/hero-slides/order`, { slide_ids: slideIds })
      .then((response) => response.data as unknown);
  },
};

/** نوع وسيلة التواصل. الهاتف وواتساب يحملان رقماً دولياً، والعنوان وساعات العمل لهما نسخة عربية. */
export type MarketContactType = "phone" | "whatsapp" | "email" | "address" | "working_hours" | "social";

/** المنصات التي تقبلها وسيلة `social`، بالقيم التي يتوقعها الخادم. */
export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "snapchat",
  "telegram",
  "linkedin",
  "other",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/** وسيلة تواصل لدولة، كما تعيدها لوحة التحكم (تشمل المتوقفة). */
export interface MarketContact {
  id: number;
  type: MarketContactType;
  platform: SocialPlatform | null;
  label: string;
  label_ar: string | null;
  value: string;
  value_ar: string | null;
  /** الرابط الجاهز للزائر: `tel` و`wa.me` و`mailto` ورابط الصفحة. `null` للعنوان وساعات العمل. */
  link: string | null;
  sort_order: number;
  is_active: boolean;
}

/** الحمولة التي يقبلها الخادم عند الإضافة والتعديل. الترتيب يُدار بالتحريك وحده. */
export interface MarketContactPayload {
  type: MarketContactType;
  platform: SocialPlatform | null;
  label: string;
  label_ar: string;
  value: string;
  value_ar: string | null;
  is_active: boolean;
}

/**
 * وسائل التواصل لكل دولة. الخادم يُنظّف الفراغات والشحطات و`00` في بداية الرقم، ويرفض الرقم المحلي
 * أو رقم دولة أخرى بـ422 برسالة على `value`.
 */
export const marketContacts = {
  /** الخادم يعيد القائمة كاملة مرتبة، وغلافها قد يكون قائمة مباشرة أو `{ contacts: [...] }`. */
  async list(code: string): Promise<MarketContact[]> {
    const { data } = await api.get<unknown>(`/markets/${encodeURIComponent(code)}/contacts`);
    const body = unwrapData<unknown>(data);
    if (Array.isArray(body)) return body as MarketContact[];
    const nested = (body as { contacts?: unknown } | null)?.contacts;
    return Array.isArray(nested) ? (nested as MarketContact[]) : [];
  },

  create(code: string, payload: MarketContactPayload): Promise<unknown> {
    return api
      .post(`/markets/${encodeURIComponent(code)}/contacts`, payload)
      .then((response) => response.data as unknown);
  },

  update(code: string, id: Id, payload: MarketContactPayload): Promise<unknown> {
    return api
      .put(`/markets/${encodeURIComponent(code)}/contacts/${id}`, payload)
      .then((response) => response.data as unknown);
  },

  remove(code: string, id: Id): Promise<unknown> {
    return api
      .delete(`/markets/${encodeURIComponent(code)}/contacts/${id}`)
      .then((response) => response.data as unknown);
  },

  /** يرسل معرّفات وسائل الدولة كلها بالترتيب الجديد. */
  reorder(code: string, contactIds: number[]): Promise<unknown> {
    return api
      .put(`/markets/${encodeURIComponent(code)}/contacts/order`, { contact_ids: contactIds })
      .then((response) => response.data as unknown);
  },
};
