// تشغيل: node --experimental-strip-types scripts/tests/awaiting-acceptance.test.mts
// اختبار الطلب الذي ينتظر القبول: الصوت يرن ما دام طلب بحالة «مُرسل»، ويتوقف حين تتغير حالته.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const modulePath = fileURLToPath(new URL("../../src/features/orders/acceptance.ts", import.meta.url));
const { AWAITING_ACCEPTANCE_STATUS, REPEAT_CHIME_MS, isAwaitingAcceptance, shouldRing } = await import(
  pathToFileURL(modulePath).href
);

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check("الحالة المنتظرة هي المُرسل", () => {
  assert.equal(AWAITING_ACCEPTANCE_STATUS, "submitted");
});

check("الطلب المُرسل ينتظر القبول، وغيره لا", () => {
  assert.equal(isAwaitingAcceptance("submitted"), true);
  for (const status of ["preparing", "ready", "on_the_way", "completed", "cancelled", "rejected", "delivery_failed", undefined]) {
    assert.equal(isAwaitingAcceptance(status), false, `status ${String(status)}`);
  }
});

check("قبول الطلب يغيّر حالته فيتوقف الصوت", () => {
  // قبل القبول: طلب واحد ينتظر، فالصوت يرن.
  assert.equal(shouldRing(true, 1), true);
  // بعد تغيير حالته: لا ينتظر أحد، فيتوقف الصوت.
  assert.equal(shouldRing(true, 0), false);
});

check("الصوت المطفأ لا يرن حتى لو وُجد طلب ينتظر", () => {
  assert.equal(shouldRing(false, 3), false);
});

check("عدة طلبات تنتظر: يرن حتى يُقبل آخرها", () => {
  assert.equal(shouldRing(true, 2), true);
  assert.equal(shouldRing(true, 1), true);
  assert.equal(shouldRing(true, 0), false);
});

check("فاصل التكرار معقول: أكثر من ثانيتين وأقل من دقيقة", () => {
  assert.ok(REPEAT_CHIME_MS > 2_000 && REPEAT_CHIME_MS < 60_000);
});

console.log(`\n${passed} tests passed`);
