// تشغيل: node --experimental-strip-types scripts/tests/item-combo.test.mts
// اختبار كومبو الصنف داخل القائمة: سعر الكومبو واحد للقائمة، والصنف يُستثنى منه بالحقل `has_combo`.
// وغياب الحقل يبقي السلوك القديم: الكومبو لكل الأصناف.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const load = async (relative: string) =>
  import(pathToFileURL(fileURLToPath(new URL(relative, import.meta.url))).href);

const combo = await load("../../src/features/menus/itemCombo.ts");

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check("صلاحية تعديل كومبو الصنف باسم الخادم", () => {
  assert.equal(combo.ITEM_COMBO_PERMISSION, "menus.items.combo.update");
});

check("has_combo يُقرأ كما يرسله الخادم، منطقياً أو 1/0", () => {
  assert.equal(combo.hasComboOf({ has_combo: true }), true);
  assert.equal(combo.hasComboOf({ has_combo: false }), false);
  assert.equal(combo.hasComboOf({ has_combo: 1 }), true);
  assert.equal(combo.hasComboOf({ has_combo: "0" }), false);
});

check("الحقل الغائب أو الغريب يعني أن الحالة غير معروفة، فلا يظهر مفتاح", () => {
  assert.equal(combo.hasComboOf({}), null);
  assert.equal(combo.hasComboOf({ has_combo: null }), null);
  assert.equal(combo.hasComboOf({ has_combo: "maybe" }), null);
});

check("الصنف المستثنى وحده يُمنع من الوجبة", () => {
  assert.equal(combo.comboAllowed({ has_combo: false }), false);
  assert.equal(combo.comboAllowed({ has_combo: true }), true);
});

check("غياب الحقل أو غياب صف الصنف يبقي الكومبو كما كان", () => {
  assert.equal(combo.comboAllowed({}), true);
  assert.equal(combo.comboAllowed({ has_combo: null }), true);
  assert.equal(combo.comboAllowed(undefined), true);
});

check("المفتاح وحده يقرّر: meal_price لا يغيّر شيئاً في ظهور الوجبة", () => {
  assert.equal(combo.comboAllowed({ has_combo: true, meal_price: null }), true);
  assert.equal(combo.comboAllowed({ has_combo: true, meal_price: "8000.00" }), true);
  assert.equal(combo.comboAllowed({ has_combo: false, meal_price: "8000.00" }), false);
  assert.equal(combo.comboAllowed({ has_combo: false, meal_price: null }), false);
});

console.log(`\n${passed} tests passed`);
