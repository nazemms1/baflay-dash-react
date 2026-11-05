// تشغيل: node --experimental-strip-types scripts/tests/branch-points.test.mts
// اختبار نطاق التوصيل ونقطة استلام السائقين: النطاق يقبل أي رقم من 0 إلى 20 بمنزلتين (0.3 أو 1.25)،
// ونقطة استلام السائق هي النقطة الخاصة بالتوصيل إن وُجدت، وإلا موقع الفرع نفسه.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const load = async (relative: string) =>
  import(pathToFileURL(fileURLToPath(new URL(relative, import.meta.url))).href);

const radius = await load("../../src/components/crud/deliveryRadius.ts");
const pickup = await load("../../src/features/drivers/pickupPoint.ts");

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

check("المنزلق يبدأ من 0.1 بخطوة 0.1 وينتهي عند 20", () => {
  assert.equal(radius.RADIUS_MIN, 0.1);
  assert.equal(radius.RADIUS_STEP, 0.1);
  assert.equal(radius.RADIUS_MAX, 20);
});

check("أرقام أقل من نصف كيلو ومنزلتان عشريتان تُقبل كما كُتبت", () => {
  assert.equal(radius.parseRadius("0.3"), 0.3);
  assert.equal(radius.parseRadius("1.25"), 1.25);
  assert.equal(radius.parseRadius("0.1"), 0.1);
  assert.equal(radius.parseRadius("20"), 20);
});

check("الفاصلة تُقبل فاصلة عشرية، والفراغ حول الرقم يُهمل", () => {
  assert.equal(radius.parseRadius("1,5"), 1.5);
  assert.equal(radius.parseRadius("  2.5 "), 2.5);
});

check("الفارغ أو ما لا يكتمل رقماً يعني بلا نطاق", () => {
  assert.equal(radius.parseRadius(""), null);
  assert.equal(radius.parseRadius("."), null);
  assert.equal(radius.parseRadius("abc"), null);
});

check("ما يتجاوز 20 يُقصّ إلى 20، وما زاد على منزلتين يُقرَّب", () => {
  assert.equal(radius.parseRadius("25"), 20);
  assert.equal(radius.parseRadius("1.239"), 1.24);
});

check("الكتابة المسموحة: رقمان صحيحان ومنزلتان عشريتان، والنصف مكتوب مسموح", () => {
  for (const text of ["", "1", "12", "1.", "1.2", "1.25", ".5", "0,3"]) assert.equal(radius.isRadiusDraft(text), true, text);
  for (const text of ["123", "1.234", "1..2", "-1", "1e2", "ab"]) assert.equal(radius.isRadiusDraft(text), false, text);
});

check("قيمة المنزلق تُنظَّف من ذيول الفاصلة العائمة", () => {
  assert.equal(radius.radiusFromSlider(0.30000000000000004), 0.3);
  assert.equal(radius.radiusFromSlider(1.1), 1.1);
  assert.equal(radius.radiusFromSlider(99), 20);
});

const branch = (fields: Record<string, unknown>) => ({ branch: { id: 1, ...fields } });

check("للفرع نقطة استلام خاصة: يذهب إليها السائق لا إلى موقع الفرع", () => {
  const order = branch({ location_x: 33.5, location_y: 36.3, delivery_location_x: 33.51, delivery_location_y: 36.31 });
  assert.deepEqual(pickup.branchPickupPoint(order), { lat: 33.51, lng: 36.31 });
});

check("بلا نقطة خاصة (null) يستعمل السائق موقع الفرع", () => {
  const order = branch({ location_x: "33.5", location_y: "36.3", delivery_location_x: null, delivery_location_y: null });
  assert.deepEqual(pickup.branchPickupPoint(order), { lat: 33.5, lng: 36.3 });
});

check("نصف نقطة لا تصلح للملاحة، فيرجع السائق إلى موقع الفرع", () => {
  const order = branch({ location_x: 33.5, location_y: 36.3, delivery_location_x: 33.51, delivery_location_y: null });
  assert.deepEqual(pickup.branchPickupPoint(order), { lat: 33.5, lng: 36.3 });
});

check("فرع بلا موقع أو طلب بلا فرع: لا نقطة ولا خطأ", () => {
  assert.equal(pickup.branchPickupPoint(branch({ location_x: null, location_y: null })), null);
  assert.equal(pickup.branchPickupPoint({}), null);
  assert.equal(pickup.branchPickupPoint({ branch: "x" }), null);
});

check("رابط الاتجاهات إلى النقطة", () => {
  assert.equal(
    pickup.directionsUrl({ lat: 33.5, lng: 36.3 }),
    "https://www.google.com/maps/dir/?api=1&destination=33.5,36.3"
  );
});

console.log(`\n${passed} tests passed`);
