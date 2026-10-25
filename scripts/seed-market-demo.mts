// بيانات وهمية للعرض فقط: وسائل تواصل ومعارض ورسائل لدول SY و IQ و AE، كلها باسم «تجريبي».
//
// معاينة بلا إرسال، تطبع كل طلب ولا تتصل بأي خادم:
//   node --experimental-strip-types scripts/seed-market-demo.mts --dry-run
//
// إرسال فعلي إلى الخادم، بعد ضبط المتغيرين. DASH_API_URL هو VITE_API_URL نفسه من ملف .env:
//   DASH_API_URL=https://.../api DASH_TOKEN=... node --experimental-strip-types scripts/seed-market-demo.mts
//
// الأرقام والبريد والروابط من نطاقات محجوزة (example.com) أو أرقام تجريبية لا تخص أحداً.
// السكربت لا يحذف شيئاً، والتشغيل مرتين يضيف البيانات مرتين، والحذف يتم من الداشبورد.
// التوكن لا يُطبع أبداً.

type Json = Record<string, unknown>;

interface Step {
  label: string;
  method: "POST";
  path: string;
  /** الطلبات التي تحمل ملفات أو حقول متعددة الأجزاء تُرسل كـ FormData، وغيرها JSON. */
  kind: "json" | "form";
  body: Json;
  /** رسائل التواصل عامة في الموقع، فلا تحتاج توكن. */
  isPublic?: boolean;
}

const MARKETS = [
  { code: "SY", dial: "963", city: "Damascus", cityAr: "دمشق" },
  { code: "IQ", dial: "964", city: "Baghdad", cityAr: "بغداد" },
  { code: "AE", dial: "971", city: "Dubai", cityAr: "دبي" },
] as const;

const contactsFor = (market: (typeof MARKETS)[number]): Json[] => {
  const phone = `+${market.dial}900000001`;
  const code = market.code.toLowerCase();
  return [
    { type: "phone", platform: null, label: "Phone", label_ar: "هاتف", value: phone, value_ar: null, is_active: true },
    { type: "whatsapp", platform: null, label: "WhatsApp", label_ar: "واتساب", value: phone, value_ar: null, is_active: true },
    {
      type: "email",
      platform: null,
      label: "Email",
      label_ar: "البريد الإلكتروني",
      value: `demo.${code}@example.com`,
      value_ar: null,
      is_active: true,
    },
    {
      type: "address",
      platform: null,
      label: "Address",
      label_ar: "العنوان",
      value: `${market.city}, Demo Street 1`,
      value_ar: `${market.cityAr}، شارع تجريبي ١`,
      is_active: true,
    },
    {
      type: "working_hours",
      platform: null,
      label: "Working hours",
      label_ar: "ساعات العمل",
      value: "Daily 10:00 - 23:00",
      value_ar: "كل يوم ١٠ ص - ١١ م",
      is_active: true,
    },
    {
      type: "social",
      platform: "facebook",
      label: "Facebook",
      label_ar: "فيسبوك",
      value: `https://example.com/bafly-demo-${code}-facebook`,
      value_ar: null,
      is_active: true,
    },
    {
      type: "social",
      platform: "instagram",
      label: "Instagram",
      label_ar: "إنستغرام",
      value: `https://example.com/bafly-demo-${code}-instagram`,
      value_ar: null,
      is_active: true,
    },
  ];
};

const steps: Step[] = [];

for (const market of MARKETS) {
  for (const body of contactsFor(market)) {
    steps.push({
      label: `contact ${market.code} ${String(body.type)}`,
      method: "POST",
      path: `markets/${market.code}/contacts`,
      kind: "json",
      body,
    });
  }
}

// المعارض: لكل دولة عرض وإنستغرام، والمعرض المشترك بشكل عادي.
for (const market of MARKETS) {
  for (const layout of ["offer", "instagram"] as const) {
    steps.push({
      label: `gallery ${market.code} ${layout}`,
      method: "POST",
      path: "galleries",
      kind: "form",
      body: {
        name: `Demo ${layout} ${market.code}`,
        name_ar: `تجريبي ${layout === "offer" ? "عروض" : "إنستغرام"} ${market.code}`,
        description: "Demo gallery",
        description_ar: "معرض تجريبي",
        market: market.code,
        layout,
      },
    });
  }
}
steps.push({
  label: "gallery general standard",
  method: "POST",
  path: "galleries",
  kind: "form",
  body: {
    name: "Demo shared",
    name_ar: "تجريبي مشترك",
    description: "Demo shared gallery",
    description_ar: "معرض مشترك تجريبي",
    market: "general",
    layout: "standard",
  },
});

// رسائل التواصل: رسالتان لكل دولة، والمرسل تجريبي.
for (const market of MARKETS) {
  for (const [index, message] of ["Question about opening hours", "Question about delivery"].entries()) {
    steps.push({
      label: `message ${market.code} ${index + 1}`,
      method: "POST",
      path: "contact-us",
      kind: "json",
      isPublic: true,
      body: {
        name: `Demo customer ${market.code}`,
        email: `demo.${market.code.toLowerCase()}@example.com`,
        message,
        market: market.code,
      },
    });
  }
}

const dryRun = process.argv.includes("--dry-run");
const baseUrl = (process.env.DASH_API_URL ?? "").replace(/\/+$/, "");
const token = process.env.DASH_TOKEN ?? "";

if (dryRun) {
  for (const step of steps) {
    console.log(`[dry-run] ${step.label}: POST ${step.path}`);
    console.log(JSON.stringify(step.body));
  }
  console.log(`\n${steps.length} طلب، لم يُرسل أي شيء.`);
  process.exit(0);
}

if (!baseUrl || !token) {
  console.error("اضبط DASH_API_URL و DASH_TOKEN، أو شغّل مع --dry-run للمعاينة فقط.");
  process.exit(1);
}

const buildBody = (step: Step): { headers: Record<string, string>; body: string | FormData } => {
  if (step.kind === "form") {
    const form = new FormData();
    for (const [key, value] of Object.entries(step.body)) form.append(key, String(value));
    return { headers: {}, body: form };
  }
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(step.body) };
};

let failed = 0;
for (const step of steps) {
  const { headers: bodyHeaders, body } = buildBody(step);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": "ar",
    ...(step.isPublic ? {} : { Authorization: `Bearer ${token}` }),
    ...bodyHeaders,
  };
  try {
    const response = await fetch(`${baseUrl}/${step.path}`, { method: step.method, headers, body });
    if (response.ok) {
      console.log(`ok   ${step.label} (${response.status})`);
    } else {
      failed += 1;
      const text = await response.text();
      console.log(`fail ${step.label} (${response.status}) ${text.slice(0, 200)}`);
    }
  } catch (error) {
    failed += 1;
    console.log(`fail ${step.label} ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${steps.length - failed} نجح، ${failed} فشل من ${steps.length}.`);
process.exit(failed > 0 ? 1 : 0);
