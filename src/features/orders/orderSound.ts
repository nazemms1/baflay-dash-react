/** سياق الصوت يُنشأ مرة واحدة، فالنغمة لا تحتاج إلى ملف ولا إلى تحميل. */
let audioContext: AudioContext | null = null;

/** سياق الصوت، أو `null` إن لم يدعم المتصفح الصوت. الإنشاء يتم عند أول حاجة إليه. */
function contextOrNull(): AudioContext | null {
  const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  if (!audioContext) audioContext = new Context();
  return audioContext;
}

/**
 * المتصفح يعلّق الصوت حتى تحصل الصفحة على نقرة من المستخدم. استدعاء هذه الدالة من أي نقرة يفكّ
 * التعليق لبقية الجلسة، فالنغمات المتكررة تعمل بعدها.
 */
export function unlockAudio(): void {
  try {
    const context = contextOrNull();
    if (context?.state === "suspended") void context.resume();
  } catch {
    // الصوت تحسين، ولا يعطّل الصفحة إن منعه المتصفح.
  }
}

/**
 * نغمتان قصيرتان تُولَّدان في المتصفح. المتصفح يمنع الصوت قبل نقرة من المستخدم، فالنغمة لا تُشغَّل
 * إلا بعد تفعيل الصوت من الزر، وهذا التفعيل نفسه يفتح الصوت لبقية الجلسة.
 */
export function playNewOrderChime(): void {
  try {
    const context = contextOrNull();
    if (!context) return;
    if (context.state === "suspended") void context.resume();

    const start = context.currentTime;
    [880, 1318].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = start + index * 0.2;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.32);
    });
  } catch {
    // الصوت تحسين، ولا يعطّل الصفحة إن منعه المتصفح.
  }
}
