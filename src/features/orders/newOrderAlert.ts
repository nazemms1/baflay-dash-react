import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toNumber, toText } from "@/lib/coerce";
import { orderAdmin } from "@/services";
import { AWAITING_ACCEPTANCE_STATUS, REPEAT_CHIME_MS, isAwaitingAcceptance, shouldRing } from "./acceptance";
import { countArrivals } from "./orderArrivals";
import { playNewOrderChime, unlockAudio } from "./orderSound";
import { showNewOrdersToast } from "./showNewOrdersToast";

const STORAGE_KEY = "orders.newOrderSound";
const POLL_INTERVAL_MS = 25_000;
// الطلبات المنتظرة للقبول تُجلب كل 10 ثوانٍ، فيتوقف الصوت قريباً بعد قبولها من أي جهاز.
const AWAITING_POLL_MS = 10_000;

function readStoredPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storePreference(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // التفضيل يبقى لهذه الجلسة فقط إن منع المتصفح التخزين.
  }
}

/**
 * تنبيه الطلبات الجديدة وصوت الطلبات المنتظرة للقبول.
 *
 * - وصول طلب جديد (رقم أكبر من كل ما رأيناه) يُعلن برسالة. الطلبات الموجودة عند فتح الصفحة لا تُعلن كوصول.
 * - الصوت يرن ما دام طلب بحالة «مُرسل» ينتظر القبول، ويتوقف حين تتغير حالته. قبوله من الصفحة يُحدّث القائمة فوراً،
 *   ومن جهاز آخر يتوقف بعد الجلب التالي. الصوت لا يرن إلا إن كان مفعّلاً، ولمن يملك صلاحية تغيير الحالة فقط.
 *
 * هذه الاستعلامات لا تتأثر بفلاتر الصفحة، فتغيير الفلتر لا يُطلق تنبيهاً كاذباً.
 */
export function useNewOrderAlert(enabled: boolean, onView?: () => void, acceptsOrders = false) {
  const queryClient = useQueryClient();
  const [soundOn, setSoundOn] = useState(readStoredPreference);
  const baseline = useRef<number | null>(null);
  // زر "عرض الأحدث" في التنبيه يستدعي أحدث نسخة من `onView`، فلا يُعاد إنشاء التنبيه مع كل رسم.
  const onViewRef = useRef(onView);
  useEffect(() => {
    onViewRef.current = onView;
  }, [onView]);

  const latest = useQuery({
    queryKey: ["orders", "new-order-alert"],
    enabled,
    // كل فتح للصفحة يجلب القائمة من الخادم، فالخط الأساسي لا يُؤخذ من الذاكرة المخزّنة.
    refetchOnMount: "always",
    refetchInterval: POLL_INTERVAL_MS,
    // التبويب المخفي لا يستعلم، فلا حمل على الخادم من صفحة لا يراها أحد.
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) => orderAdmin.list({ page: 1, perPage: 20 }, signal),
  });

  // البيانات التي كانت في الذاكرة عند الفتح لا تُقاس بها: القياس يبدأ من جلب وصل بعد الفتح.
  const [cachedAt] = useState(latest.dataUpdatedAt);
  const fetchedHere = latest.dataUpdatedAt !== cachedAt;
  const data = latest.data;

  // الطلبات المنتظرة للقبول بحالتها من الخادم، لا من أحدث 20 طلباً، فلا يفوت الصوت طلباً قديماً ما زال ينتظر.
  const awaiting = useQuery({
    queryKey: ["orders", "awaiting-acceptance"],
    enabled: enabled && acceptsOrders,
    refetchOnMount: "always",
    refetchInterval: AWAITING_POLL_MS,
    refetchIntervalInBackground: false,
    queryFn: ({ signal }) =>
      orderAdmin.list({ status: AWAITING_ACCEPTANCE_STATUS, page: 1, perPage: 50 }, signal),
  });
  const awaitingCount = (awaiting.data?.items ?? []).filter((row) => isAwaitingAcceptance(toText(row.status))).length;

  useEffect(() => {
    if (!data || !fetchedHere) return;
    const { arrived, next } = countArrivals(
      baseline.current,
      data.items.map((row) => toNumber(row.id))
    );
    baseline.current = next;
    if (arrived === 0) return;

    // الصوت لا يُشغَّل هنا: الطلب الجديد ينتظر القبول، ونغمة الانتظار تبدأ من الاستعلام الخاص به.
    showNewOrdersToast(arrived, () => onViewRef.current?.());
    // قائمة الصفحة تُحدَّث لتظهر الطلبات الجديدة، بفلاترها الحالية.
    void queryClient.invalidateQueries({ queryKey: ["orders", "admin"] });
    void queryClient.invalidateQueries({ queryKey: ["orders", "awaiting-acceptance"] });
  }, [data, fetchedHere, queryClient]);

  // نغمة تبدأ فوراً ثم تتكرر ما دام الصوت يرن، وتتوقف بتوقفه: حين لا ينتظر أحد أو يُطفأ الصوت.
  const ringing = shouldRing(soundOn, awaitingCount);
  useEffect(() => {
    if (!ringing) return;
    playNewOrderChime();
    const timer = window.setInterval(playNewOrderChime, REPEAT_CHIME_MS);
    return () => window.clearInterval(timer);
  }, [ringing]);

  // المتصفح يعلّق الصوت حتى نقرة في الصفحة، فأول نقرة بعد التحميل تفكّ التعليق للنغمات القادمة.
  useEffect(() => {
    if (!soundOn) return;
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, [soundOn]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    storePreference(next);
    // النقرة تفتح الصوت في المتصفح، والنغمة تؤكد للمستخدم أنه فعّله.
    if (next) playNewOrderChime();
  }, [soundOn]);

  return { soundOn, toggleSound };
}
