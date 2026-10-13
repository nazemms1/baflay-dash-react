// تشغيل: node --experimental-strip-types scripts/tests/offered-extras.test.mts
// اختبار منطق الإضافات المعروضة لكل فرع، بمعزل عن الواجهة. يعمل بـ Node مع دعم حذف الأنواع.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const modulePath = fileURLToPath(new URL("../../src/features/orders/offeredExtras.ts", import.meta.url));
const { offeredExtraIds, visibleExtras } = await import(pathToFileURL(modulePath).href);

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

// 1) قراءة القائمة العامة للفرع
check("قائمة غير معروفة تعني عدم الفلترة (null)", () => {
  assert.equal(offeredExtraIds(null), null);
  assert.equal(offeredExtraIds({}), null);
  assert.equal(offeredExtraIds({ extras: null }), null);
  assert.equal(offeredExtraIds({ extras: "13" }), null);
});

check("قائمة فارغة تعني أن الفرع لا يعرض أي إضافة (وليست null)", () => {
  assert.deepEqual(offeredExtraIds({ extras: [] }), []);
});

check("تقبل أرقاماً وكائنات بـ id أو ingredient_id ونصوصاً، وتتجاهل التالف", () => {
  const menu = { extras: [13, { id: 20 }, { ingredient_id: 27 }, { id: "30" }, null, {}, "x", 0, -1, 2.5] };
  assert.deepEqual(offeredExtraIds(menu), [13, 20, 27, 30]);
});

// 2) ما يظهر للكاشير
check("فرع بلا استبعاد: تبقى كل الإضافات، والصلصات إلا ما هو إضافة للصنف", () => {
  const result = visibleExtras({ brandExtras: [13, 20], itemAddOns: [13, 50], offered: [13, 20, 50] });
  assert.deepEqual(result, { sauces: [20], addOns: [13, 50] });
});

check("القائمة غير معروفة: لا فلترة، وتُعاد نسخ جديدة", () => {
  const brand = [13, 20];
  const items = [50];
  const result = visibleExtras({ brandExtras: brand, itemAddOns: items, offered: null });
  assert.deepEqual(result, { sauces: [13, 20], addOns: [50] });
  assert.notEqual(result.sauces, brand);
  assert.notEqual(result.addOns, items);
});

check("مكوّن هو إضافة للصنف يظهر في إضافات الصنف فقط ولا يتكرر في الإضافات العامة", () => {
  assert.deepEqual(visibleExtras({ brandExtras: [20, 30], itemAddOns: [20], offered: [20, 30] }), {
    sauces: [30],
    addOns: [20],
  });
  assert.deepEqual(visibleExtras({ brandExtras: [20, 30], itemAddOns: [20], offered: null }), {
    sauces: [30],
    addOns: [20],
  });
});

check("فرع لا يعرض أي إضافة: تختفي صلصات البراند وإضافات الصنف التي من البراند", () => {
  const result = visibleExtras({ brandExtras: [13, 20], itemAddOns: [13, 99], offered: [] });
  assert.deepEqual(result, { sauces: [], addOns: [99] });
});

check("حالة فرع المزة: ما أطفأه الفرع يغيب من الصلصات والإضافات", () => {
  // البراند: 13 و20 و27 و30. الفرع يعرض 20 و30 و40 فقط.
  // إضافات الصنف: 13 و27 (مُطفأتان) و50 (ليست من البراند فتبقى).
  const result = visibleExtras({
    brandExtras: [13, 20, 27, 30],
    itemAddOns: [13, 27, 50],
    offered: [20, 30, 40],
  });
  assert.deepEqual(result, { sauces: [20, 30], addOns: [50] });
});

check("إضافة صنف معروضة في الفرع وليست من البراند تبقى", () => {
  const result = visibleExtras({ brandExtras: [], itemAddOns: [77], offered: [20] });
  assert.deepEqual(result, { sauces: [], addOns: [77] });
});

check("المدخلات الفارغة تعطي نتيجة فارغة", () => {
  assert.deepEqual(visibleExtras({ brandExtras: [], itemAddOns: [], offered: [] }), { sauces: [], addOns: [] });
  assert.deepEqual(visibleExtras({ brandExtras: [], itemAddOns: [], offered: null }), { sauces: [], addOns: [] });
});

check("الترتيب يبقى كما يأتي من الخادم", () => {
  const result = visibleExtras({ brandExtras: [30, 13, 20], itemAddOns: [], offered: [20, 13, 30] });
  assert.deepEqual(result.sauces, [30, 13, 20]);
});

console.log(`\n${passed} tests passed`);
