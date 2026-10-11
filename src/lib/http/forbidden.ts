/**
 * الخروج من شاشة ممنوعة إلى تسجيل الدخول. يُسجَّل المعالج من التطبيق عند الإقلاع، فلا تستورد
 * وحدة الطلبات متجر الجلسة مباشرة (ذلك يخلق دورة استيراد مع واجهة الدخول).
 */
let handler: (() => void) | null = null;

export function setForbiddenHandler(next: () => void): void {
  handler = next;
}

export function returnToLogin(): void {
  handler?.();
}
