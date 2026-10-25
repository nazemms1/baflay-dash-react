// تشغيل: node --experimental-strip-types scripts/tests/branch-hours.test.mts
// اختبار أوقات الدوام لكل يوم وأيام العطل، وحالة الفرع: الفرع مفتوح كل يوم افتراضياً، وجسم الحفظ
// يرسل `null` حين يكون مفتوحاً طوال الأيام، والأيام السبعة بساعاتها حين يختلف ذلك، ووقت الفرع
// الذي لا يتبع جهاز المشغّل.
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const load = async (relative: string) =>
  import(pathToFileURL(fileURLToPath(new URL(relative, import.meta.url))).href);

const hours = await load("../../src/features/branches/openingHours.ts");
const status = await load("../../src/features/branches/branchStatus.ts");

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
};

const WEEK = ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday"];
const FULL = [{ opens: "00:00", closes: "24:00" }];
const SUNDAY = [
  { opens: "12:00", closes: "15:00" },
  { opens: "18:00", closes: "24:00" },
];
const SATURDAY = [{ opens: "10:00", closes: "02:00" }];

const withHours = (overrides: Record<string, unknown>) => ({ ...hours.defaultHours(), ...overrides });

check("الأيام تبدأ بالسبت كما يرتّبها الخادم", () => {
  assert.deepEqual([...hours.WEEK_DAYS], WEEK);
});

check("الافتراضي: كل يوم مفتوح طوال اليوم", () => {
  const defaults = hours.defaultHours();
  for (const day of WEEK) assert.deepEqual(defaults[day], FULL);
});

check("الحد الأعلى ثلاث فترات للتكرار", () => {
  assert.equal(hours.MAX_PERIODS, 3);
});

check("الفترة السليمة تمرّ، وإغلاق 24:00 لمنتصف الليل مقبول", () => {
  assert.equal(hours.periodIssue({ opens: "10:00", closes: "02:00" }), null);
  assert.equal(hours.periodIssue({ opens: "10:00", closes: "24:00" }), null);
  assert.equal(hours.periodIssue({ opens: "00:00", closes: "24:00" }), null);
});

check("الوقت خارج ٢٤ ساعة أو بلا صفر بادئ مرفوض", () => {
  assert.equal(hours.periodIssue({ opens: "25:00", closes: "02:00" }), "invalidOpens");
  assert.equal(hours.periodIssue({ opens: "9:00", closes: "12:00" }), "invalidOpens");
  assert.equal(hours.periodIssue({ opens: "24:00", closes: "12:00" }), "invalidOpens");
  assert.equal(hours.periodIssue({ opens: "10:00", closes: "24:30" }), "invalidCloses");
});

check("بيفتح وبيسكّر بنفس الدقيقة مرفوض", () => {
  assert.equal(hours.periodIssue({ opens: "10:00", closes: "10:00" }), "sameTime");
});

check("الفترة التي تُغلق قبل أن تُفتح تنتهي في اليوم التالي، و24:00 لا تنتهي غداً", () => {
  assert.equal(hours.closesNextDay(SATURDAY[0]), true);
  assert.equal(hours.closesNextDay({ opens: "00:00", closes: "04:00" }), false);
  assert.equal(hours.closesNextDay({ opens: "22:00", closes: "24:00" }), false);
  assert.equal(hours.closesNextDay({ opens: "12:00", closes: "15:00" }), false);
});

check("مشاكل الفترات تُعلَّم بمفتاح اليوم ورقم الفترة، ولا تُفحص الأيام المعطّلة", () => {
  const current = withHours({ monday: [{ opens: "10:00", closes: "12:00" }, { opens: "13:00", closes: "13:00" }] });
  assert.deepEqual(hours.hoursIssues(current, []), { "monday.1": "sameTime" });
  assert.deepEqual(hours.hoursIssues(current, ["monday"]), {});
});

check("جدول null من الخادم يعني مفتوح كل الأيام طوال اليوم بلا عطل", () => {
  const { holidays, hours: read } = hours.hoursFrom(null);
  assert.deepEqual(holidays, []);
  for (const day of WEEK) assert.deepEqual(read[day], FULL);
});

check("اليوم الذي يرسله الخادم بلا فترات يُقرأ عطلة", () => {
  const { holidays } = hours.hoursFrom({
    saturday: FULL,
    sunday: FULL,
    monday: [],
    tuesday: FULL,
    wednesday: FULL,
    thursday: FULL,
    friday: [],
  });
  assert.deepEqual(holidays, ["monday", "friday"]);
});

check("ساعات كل يوم مفتوح تُقرأ كما هي، بفتراتها المتعددة", () => {
  const { holidays, hours: read } = hours.hoursFrom({
    saturday: SATURDAY,
    sunday: SUNDAY,
    monday: FULL,
    tuesday: FULL,
    wednesday: FULL,
    thursday: FULL,
    friday: FULL,
  });
  assert.deepEqual(holidays, []);
  assert.deepEqual(read.saturday, SATURDAY);
  assert.deepEqual(read.sunday, SUNDAY);
});

check("الفرع مفتوح دائماً فقط إن كانت كل الأيام طوال اليوم بلا عطل", () => {
  assert.equal(hours.isAlwaysOpen([], hours.defaultHours()), true);
  assert.equal(hours.isAlwaysOpen(["friday"], hours.defaultHours()), false);
  assert.equal(hours.isAlwaysOpen([], withHours({ sunday: SUNDAY })), false);
});

check("مفتوح طوال الأيام بلا عطل: الجسم `opening_hours: null` بلا منطقة زمنية", () => {
  assert.deepEqual(hours.openingHoursBody([], hours.defaultHours(), "   "), { opening_hours: null });
});

check("يوم بساعات مخصصة: يرسل الأيام السبعة وساعاته بفتراتها", () => {
  const body = hours.openingHoursBody([], withHours({ sunday: SUNDAY }), "") as {
    opening_hours: Record<string, unknown>;
  };
  assert.deepEqual(Object.keys(body.opening_hours).sort(), [...WEEK].sort());
  assert.deepEqual(body.opening_hours.sunday, SUNDAY);
  assert.deepEqual(body.opening_hours.monday, FULL);
});

check("عطلة يوم: يُرسل بقائمة فارغة، ويبقى المنطقة الزمنية المكتوبة", () => {
  const body = hours.openingHoursBody(["friday"], hours.defaultHours(), " Asia/Damascus ") as {
    timezone: string;
    opening_hours: Record<string, unknown>;
  };
  assert.equal(body.timezone, "Asia/Damascus");
  assert.deepEqual(body.opening_hours.friday, []);
  assert.deepEqual(body.opening_hours.saturday, FULL);
});

check("ساعات يوم العطلة تُحفظ داخل النافذة، وإعادة فتحه تعيدها", () => {
  const current = withHours({ sunday: SUNDAY });
  const withHoliday = hours.openingHoursBody(["sunday"], current, "") as { opening_hours: Record<string, unknown> };
  assert.deepEqual(withHoliday.opening_hours.sunday, []);

  const reopened = hours.openingHoursBody([], current, "") as { opening_hours: Record<string, unknown> };
  assert.deepEqual(reopened.opening_hours.sunday, SUNDAY);
});

check("المنطقة الزمنية تغيب إن كانت فارغة", () => {
  assert.equal("timezone" in hours.openingHoursBody(["monday"], hours.defaultHours(), ""), false);
});

check("حالة الفرع تُقرأ من closed_reason كما يعيدها الخادم", () => {
  assert.equal(status.branchStatusOf({ closed_reason: null }), "open");
  assert.equal(status.branchStatusOf({ closed_reason: "closed_by_branch" }), "closedByBranch");
  assert.equal(status.branchStatusOf({ closed_reason: "outside_opening_hours" }), "outsideHours");
  assert.equal(status.branchStatusOf({ closed_reason: "hidden" }), "hidden");
});

check("الحقل الغائب لا يُفترض له أنه مفتوح", () => {
  assert.equal(status.branchStatusOf({}), "unknown");
});

check("وقت الفتح يُعرض بتوقيت الفرع لا بتوقيت الجهاز", () => {
  const iso = "2026-10-18T10:00:00+03:00";
  assert.equal(status.localClock(iso, "Asia/Damascus"), "10:00");
  assert.equal(status.localClock(iso, "Asia/Dubai"), "11:00");
});

check("منتصف الليل يظهر 00:00 لا 24:00", () => {
  assert.equal(status.localClock("2026-10-18T00:00:00+03:00", "Asia/Damascus"), "00:00");
});

check("وقت غائب أو منطقة غير معروفة لا يكسران العرض", () => {
  assert.equal(status.localClock(null, "Asia/Damascus"), null);
  assert.equal(status.localClock("ليس تاريخاً", "Asia/Damascus"), null);
  assert.equal(status.localClock("2026-10-18T10:00:00+03:00", "Nowhere/City"), null);
});

console.log(`\n${passed} tests passed`);
