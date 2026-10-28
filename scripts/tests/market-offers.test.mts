// تشغيل: node --experimental-strip-types scripts/tests/market-offers.test.mts
// قواعد عروض الدولة قبل الإرسال: الرابط فارغ أو https:// أو صفحة بالموقع تبدأ بـ/، والترتيب حسب
// sort_order ثم المعرّف.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const rules = await import(
  pathToFileURL(fileURLToPath(new URL("../../src/features/market-offers/offerRules.ts", import.meta.url))).href
);

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check("الرابط الفارغ مقبول، وكذلك المسافات وحدها", () => {
  assert.equal(rules.isOfferLink(""), true);
  assert.equal(rules.isOfferLink("   "), true);
});

check("الرابط الكامل https:// مقبول", () => {
  assert.equal(rules.isOfferLink("https://instagram.com/p/demo"), true);
});

check("صفحة الموقع تبدأ بـ/ مقبولة مثل /menu", () => {
  assert.equal(rules.isOfferLink("/menu"), true);
  assert.equal(rules.isOfferLink("/"), true);
});

check("الرابط بغير https أو بلا بداية واضحة يُرفض", () => {
  assert.equal(rules.isOfferLink("http://example.com"), false);
  assert.equal(rules.isOfferLink("example.com/menu"), false);
  assert.equal(rules.isOfferLink("https://"), false);
  assert.equal(rules.isOfferLink("/menu with spaces"), false);
});

check("الترتيب حسب sort_order ثم المعرّف", () => {
  const ids = rules
    .sortOffers([
      { id: 3, sort_order: 2 },
      { id: 1, sort_order: 2 },
      { id: 2, sort_order: 1 },
    ])
    .map((offer: { id: number }) => offer.id);
  assert.deepEqual(ids, [2, 1, 3]);
});

console.log(`\n${passed} اختبارات نجحت`);
