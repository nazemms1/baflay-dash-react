import Cookies from "js-cookie";

/**
 * التوكن في كوكي بمدة 30 يوماً كما في النسخة القديمة. اسمها مختلف كي لا
 * يتعارض مع جلسة قديمة على النطاق نفسه.
 */
const TOKEN_COOKIE = "bafly_dash_token";
const TOKEN_DAYS = 30;

export const getStoredToken = (): string | null => Cookies.get(TOKEN_COOKIE) ?? null;

/** `remember` يحدّد هل تبقى الكوكي 30 يوماً، أم تنتهي بإغلاق المتصفح. */
export function storeToken(token: string, remember = true): void {
  Cookies.set(TOKEN_COOKIE, token, {
    expires: remember ? TOKEN_DAYS : undefined,
    sameSite: "strict",
    secure: window.location.protocol === "https:",
  });
}

export function clearStoredToken(): void {
  Cookies.remove(TOKEN_COOKIE, { sameSite: "strict" });
}
