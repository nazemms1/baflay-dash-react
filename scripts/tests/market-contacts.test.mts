// تشغيل: node --experimental-strip-types scripts/tests/market-contacts.test.mts
// قواعد وسائل التواصل قبل الإرسال: الرقم الدولي يبدأ برمز الدولة، و00 تصير +، والرابط الكامل
// يبدأ بـ https://، والترتيب حسب sort_order ثم المعرّف.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const rules = await import(
  pathToFileURL(fileURLToPath(new URL("../../src/features/market-contacts/contactRules.ts", import.meta.url))).href
);

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check("الرقم الدولي الذي يبدأ برمز الدولة صالح", () => {
  assert.equal(rules.phoneProblem("+963912345678", "963"), null);
  assert.equal(rules.phoneProblem("+963 912-345-678", "963"), null);
});

check("00 في البداية تُقرأ كـ+ كما يفعل الخادم", () => {
  assert.equal(rules.normalizePhone("00 963-912"), "+963912");
  assert.equal(rules.phoneProblem("00963912345678", "963"), null);
});

check("الرقم المحلي أو بلا + يُرفض بسبب البداية", () => {
  assert.equal(rules.phoneProblem("0912345678", "963"), "start");
  assert.equal(rules.phoneProblem("963912345678", "963"), "start");
});

check("رقم دولة أخرى يُرفض بسبب الرمز", () => {
  assert.equal(rules.phoneProblem("+971501234567", "963"), "country");
});

check("رمز الاتصال المكتوب بلا + يُقارن بالأرقام فقط", () => {
  assert.equal(rules.phoneProblem("+963912345678", "+963"), null);
});

check("بلا رمز لدولة السوق لا يُفحص الرمز، والصيغة فقط", () => {
  assert.equal(rules.phoneProblem("+1234567", null), null);
  assert.equal(rules.phoneProblem("+963", "963"), "format");
});

check("الرابط الكامل يبدأ بـ https://", () => {
  assert.equal(rules.isFullUrl("https://instagram.com/bafly"), true);
  assert.equal(rules.isFullUrl("http://example.com"), false);
  assert.equal(rules.isFullUrl("instagram.com/bafly"), false);
});

check("البريد بصيغة بسيطة", () => {
  assert.equal(rules.isEmail("info@example.com"), true);
  assert.equal(rules.isEmail("info@example"), false);
});

check("الترتيب حسب sort_order ثم المعرّف", () => {
  const ids = rules
    .sortContacts([
      { id: 3, sort_order: 2 },
      { id: 1, sort_order: 2 },
      { id: 2, sort_order: 1 },
    ])
    .map((contact: { id: number }) => contact.id);
  assert.deepEqual(ids, [2, 1, 3]);
});

console.log(`\n${passed} اختبارات نجحت`);
