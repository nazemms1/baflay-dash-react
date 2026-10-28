import type { ReactNode } from "react";
import type { MarketOffer } from "@/services";

/** تفاصيل العرض: الصورة كاملة، ثم الرابط كما يصل إليه الزائر. */
export function OfferDetails({ record }: { record: MarketOffer }) {
  const linkNode: ReactNode = record.link ? (
    <a href={record.link} target="_blank" rel="noreferrer" dir="ltr" className="break-all text-primary underline">
      {record.link}
    </a>
  ) : (
    "—"
  );
  return (
    <div className="space-y-4">
      <img src={record.image} alt="" className="max-h-96 w-full rounded-xl object-contain ring-1 ring-line" />
      <p className="text-ink">{linkNode}</p>
    </div>
  );
}
