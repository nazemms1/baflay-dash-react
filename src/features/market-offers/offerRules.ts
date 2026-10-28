import type { MarketOffer } from "@/services";

/**
 * الرابط الاختياري للعرض: فارغ، أو رابط كامل يبدأ بـ`https://`، أو صفحة بالموقع تبدأ بـ`/` مثل `/menu`.
 * الخادم هو الحكم النهائي، وهذا يمنع الخطأ الواضح قبل الإرسال.
 */
export const isOfferLink = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return /^https:\/\/\S+$/i.test(trimmed) || /^\/\S*$/.test(trimmed);
};

/** الترتيب كما يراه الزائر: حسب `sort_order`، والتعادل بالمعرّف. */
export const sortOffers = (offers: MarketOffer[]): MarketOffer[] =>
  [...offers].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
