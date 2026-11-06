import axios from "axios";
import { toast } from "sonner";
import { env } from "@/config/env";
import i18n from "@/i18n";
import { getStoredToken } from "@/lib/token-storage";
import { toApiError } from "./errors";
import { returnToLogin } from "./forbidden";

declare module "axios" {
  interface AxiosRequestConfig {
    /** الطلب يتولى صاحبه عرض الخطأ (مثلاً خطأ تحقق داخل نموذج). */
    silentError?: boolean;
  }
}

export const api = axios.create({
  baseURL: env.apiUrl,
  timeout: 20_000,
  headers: { Accept: "application/json" },
});

/** تُسجَّل مرة واحدة من التطبيق: تفريغ الجلسة وتحويل المستخدم إلى الدخول. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // الخادم يرسل رسائله بلغة الواجهة نفسها.
  config.headers["Accept-Language"] = i18n.language;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // الإلغاء المقصود (تغيّر الفلتر مثلاً) ليس خطأً يُعرض للمستخدم.
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const isNetworkFailure = axios.isAxiosError(error) && !error.response;
    const fallback = isNetworkFailure
      ? i18n.t("errors.network")
      : i18n.t("errors.unexpected");
    const apiError = toApiError(error, fallback);

    if (apiError.status === 401 && getStoredToken()) {
      onSessionExpired?.();
      toast.error(i18n.t("errors.sessionExpired"));
    } else if (apiError.status === 403 && apiError.code === "outside_your_branch") {
      // مدير الفرع يعدّل فرعه وحده. هذا ليس نقص صلاحية يُصلحه تسجيل الدخول، فرسالة عادية بلا زر.
      if (!(axios.isAxiosError(error) && error.config?.silentError)) {
        toast.error(i18n.t("errors.outsideYourBranch"), { id: "outside-your-branch" });
      }
    } else if (apiError.status === 403) {
      // نقص الصلاحية: رسالة مترجمة تبقى ظاهرة مع زر يعيد المستخدم إلى تسجيل الدخول.
      toast.warning(i18n.t("errors.forbidden"), {
        id: "forbidden",
        duration: Infinity,
        action: { label: i18n.t("errors.backToLogin"), onClick: returnToLogin },
      });
    } else if (!(axios.isAxiosError(error) && error.config?.silentError)) {
      toast.error(apiError.message);
    }

    return Promise.reject(apiError);
  }
);
