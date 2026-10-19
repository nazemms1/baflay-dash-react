/**
 * الطلب الذي ينتظر القبول هو الطلب المُرسل الذي لم تتغير حالته بعد. قبوله يعني تغيير حالته
 * (إلى التحضير مثلاً، أو الإلغاء أو الرفض)، فيخرج من هذه الحالة ويتوقف الصوت عنه.
 * لا يستورد هذا الملف شيئاً من المشروع، ليعمل في اختبارات Node مباشرة.
 */
export const AWAITING_ACCEPTANCE_STATUS = "submitted";

/** فاصل تكرار النغمة ما دام طلب ينتظر القبول، بالملي ثانية. */
export const REPEAT_CHIME_MS = 4_000;

export function isAwaitingAcceptance(status: unknown): boolean {
  return status === AWAITING_ACCEPTANCE_STATUS;
}

/** الصوت يرن إن كان مفعّلاً ويوجد طلب واحد على الأقل ينتظر القبول. */
export function shouldRing(soundOn: boolean, awaitingCount: number): boolean {
  return soundOn && awaitingCount > 0;
}
