// تشغيل: node --experimental-strip-types scripts/tests/counter-body.test.mts
// اختبار جسم طلب الكاشير: كميات الإضافات، وكميات الصلصات مضروبة في وحدات السطر، والمجاميع.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const modulePath = fileURLToPath(new URL("../../src/features/orders/buildOrderBody.ts", import.meta.url));
const { buildCounterOrderBody, cartTotals } = await import(pathToFileURL(modulePath).href);

const item = (overrides: Record<string, unknown>) => ({
  kind: "item",
  key: "k",
  itemId: 1,
  name: "Burger",
  image: null,
  variant: "sandwich",
  addOns: [],
  sauces: [],
  notes: "",
  quantity: 1,
  unitPrice: 10,
  currency: "USD",
  ...overrides,
});

const body = (lines: unknown[]) =>
  buildCounterOrderBody({ branchId: 3, lines, customerName: "", customerPhone: "" });

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check("كمية الإضافة تُرسل كما اختارها الكاشير، لا 1 دائماً", () => {
  const result = body([item({ addOns: [{ id: 7, name: "Cheese", price: 1, quantity: 2 }] })]);
  assert.deepEqual(result.items[0].add_ons, [{ id: 7, quantity: 2 }]);
});

check("الصلصة تُرسل بكميتها لكل وحدة × وحدات السطر", () => {
  const result = body([item({ quantity: 3, sauces: [{ id: 9, name: "Garlic", price: 0, quantity: 2 }] })]);
  assert.deepEqual(result.extras, [{ id: 9, quantity: 6 }]);
});

check("الصلصة نفسها في سطرين تُجمع كمياتها", () => {
  const result = body([
    item({ key: "a", quantity: 1, sauces: [{ id: 9, name: "Garlic", price: 0, quantity: 1 }] }),
    item({ key: "b", quantity: 2, sauces: [{ id: 9, name: "Garlic", price: 0, quantity: 1 }] }),
  ]);
  assert.deepEqual(result.extras, [{ id: 9, quantity: 3 }]);
});

check("الإضافات بلا كمية ترسل مصفوفة فارغة، والصلصات كذلك", () => {
  const result = body([item({})]);
  assert.deepEqual(result.items[0].add_ons, []);
  assert.deepEqual(result.extras, []);
});

check("المجاميع: الإضافات والصلصات تدخل في سعر الوحدة كما تُحسب في النافذة", () => {
  const totals = cartTotals([item({ quantity: 2, unitPrice: 13 })]);
  assert.equal(totals.subtotal, 26);
  assert.equal(totals.tax, 2.6);
  assert.equal(totals.total, 28.6);
});

console.log(`\n${passed} tests passed`);
