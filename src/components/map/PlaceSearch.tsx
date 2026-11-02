import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { currentLanguage } from "@/i18n";
import { toLatLng, type GoogleMapsLibraries } from "@/lib/googleMaps";
import type { LatLng } from "./LocationPicker";

/** الانتظار بعد آخر حرف قبل طلب الاقتراحات، حتى لا يُطلب مع كل حرف. */
const DEBOUNCE_MS = 300;
/** الزوم الذي تقف عنده الخريطة بعد الاختيار، ليرى المستخدم الشارع لا المدينة. */
const PLACE_ZOOM = 16;

interface PlaceSearchProps {
  map: google.maps.Map;
  places: GoogleMapsLibraries["places"];
  onPick: (point: LatLng) => void;
}

/**
 * حقل بحث فوق الخريطة. يقترح أماكن وعناوين أثناء الكتابة، والاختيار ينقل الخريطة
 * إلى المكان ويضع النقطة عليه. جلسة البحث تُغلق عند الاختيار، كما تطلب Google
 * لتُحتسب الطلبات بسعرها الصحيح.
 */
export function PlaceSearch({ map, places, onPick }: PlaceSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.PlacePrediction[]>([]);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  // رقم الطلب الأخير، فلا تحل استجابة قديمة محل نتائج أحدث وصلت قبلها.
  const requestRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const search = async (input: string) => {
    const request = ++requestRef.current;
    if (!sessionRef.current) sessionRef.current = new places.AutocompleteSessionToken();
    try {
      const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionRef.current,
        locationBias: map.getCenter(),
        language: currentLanguage(),
      });
      if (request !== requestRef.current) return;
      setPredictions(
        suggestions
          .map((suggestion) => suggestion.placePrediction)
          .filter((prediction): prediction is google.maps.places.PlacePrediction => prediction !== null)
      );
    } catch {
      // خطأ الشبكة أو المفتاح لا يوقف الخريطة، فتبقى القائمة فارغة ويبقى النقر على الخريطة متاحاً.
      if (request === requestRef.current) setPredictions([]);
    }
  };

  const onInput = (value: string) => {
    setQuery(value);
    window.clearTimeout(timerRef.current);
    // أي استجابة قادمة لنص قديم لم تعد صالحة، حتى قبل أن يبدأ البحث الجديد.
    requestRef.current += 1;
    const input = value.trim();
    if (input === "") {
      setPredictions([]);
      return;
    }
    timerRef.current = window.setTimeout(() => void search(input), DEBOUNCE_MS);
  };

  const pick = async (prediction: google.maps.places.PlacePrediction) => {
    const place = prediction.toPlace();
    try {
      await place.fetchFields({ fields: ["location"] });
    } catch {
      setPredictions([]);
      return;
    }
    sessionRef.current = null;
    setPredictions([]);
    setQuery(prediction.text.text);

    const point = toLatLng(place.location);
    if (!point) return;
    onPick(point);
    map.panTo(point);
    if ((map.getZoom() ?? 0) < PLACE_ZOOM) map.setZoom(PLACE_ZOOM);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter يختار أول اقتراح، ولا يُرسل النموذج الذي يحوي الحقل.
    if (event.key === "Enter") {
      event.preventDefault();
      if (predictions[0]) void pick(predictions[0]);
    } else if (event.key === "Escape") {
      setPredictions([]);
    }
  };

  return (
    <div className="relative z-20">
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="text"
        aria-label={t("crud.location.searchPlaceholder")}
        placeholder={t("crud.location.searchPlaceholder")}
        autoComplete="off"
        value={query}
        onChange={(event) => onInput(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setPredictions([])}
        className="h-11 w-full rounded-xl border border-line bg-surface ps-10 pe-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/20"
      />
      {predictions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-lg">
          {predictions.map((prediction) => (
            <li key={prediction.placeId}>
              <button
                type="button"
                // يمنع فقد التركيز عند النقر، فيصل النقر للاختيار قبل أن يُغلق الحقل القائمة.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void pick(prediction)}
                className="flex w-full cursor-pointer flex-col items-start px-3.5 py-2 text-start hover:bg-canvas"
              >
                <span className="text-sm font-medium text-ink">{prediction.mainText?.text ?? prediction.text.text}</span>
                {prediction.secondaryText && (
                  <span className="text-xs text-muted">{prediction.secondaryText.text}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
