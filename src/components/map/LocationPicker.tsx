import { useEffect, useRef, useState } from "react";
import { env } from "@/config/env";
import { loadGoogleMaps, toLatLng, type GoogleMapsLibraries } from "@/lib/googleMaps";

/** وسط دمشق، يُستعمل حين لا يوجد موقع محفوظ بعد. */
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 33.5138, lng: 36.2765 };

export interface LatLng {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  /** نطاق التوصيل بالكيلومتر، يُرسم دائرةً حول النقطة. بدونه لا تُرسم دائرة. */
  radiusKm?: number | null;
  readOnly?: boolean;
  height?: string;
  onChange?: (point: LatLng) => void;
}

interface MapState {
  map: google.maps.Map;
  libs: GoogleMapsLibraries;
}

/** نقطة العلامة: دائرة صغيرة بالألوان نفسها التي كانت على الخريطة السابقة. */
const createMarkerElement = () => {
  const dot = document.createElement("span");
  dot.className = "block size-5 rounded-full bg-secondary ring-4 ring-primary shadow-lg";
  return dot;
};

/** يركّز الخريطة على الحدود، ويحدّ الزوم بـ15 كما كان في الخريطة السابقة. */
const fitBoundsCapped = (map: google.maps.Map, bounds: google.maps.LatLngBounds) => {
  map.fitBounds(bounds, 24);
  google.maps.event.addListenerOnce(map, "idle", () => {
    if ((map.getZoom() ?? 0) > 15) map.setZoom(15);
  });
};

/**
 * خريطة لتحديد نقطة. النقر يضع العلامة، وسحبها يعدّلها، والدائرة تُظهر نطاق
 * التوصيل إن مُرِّر، وتتحدث مع الرقم مباشرة. في وضع القراءة تبقى الخريطة للعرض فقط.
 */
export function LocationPicker({
  lat,
  lng,
  radiusKm,
  readOnly = false,
  height = "18rem",
  onChange,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<MapState | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const centeredRef = useRef(false);
  // حدود الدائرة الحالية، فيُركَّز عليها متى صار للحاوية حجم حقيقي.
  const boundsRef = useRef<google.maps.LatLngBounds | null>(null);

  // الاستدعاءات تُحدَّث دون إعادة إنشاء الخريطة، فلا تتعلّق الأحداث بقيمة قديمة.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // إنشاء الخريطة عند كل تغيير في وضع القراءة، وتفريغ حاويتها عند الخروج.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !env.googleMapsApiKey) return;

    let active = true;
    let observer: ResizeObserver | undefined;

    loadGoogleMaps()
      .then((libs) => {
        if (!active) return;

        const map = new libs.maps.Map(container, {
          center: DEFAULT_CENTER,
          zoom: 12,
          mapId: env.googleMapId || undefined,
          gestureHandling: readOnly ? "none" : "cooperative",
          clickableIcons: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        if (!readOnly) {
          map.addListener("click", (event: google.maps.MapMouseEvent) => {
            const point = toLatLng(event.latLng);
            if (point) onChangeRef.current?.(point);
          });
        }

        // الخريطة داخل نافذة تتحرك وتكبر لحظة فتحها: حين تأخذ الحاوية حجمها الحقيقي نُعيد رسم
        // الخريطة، ونركّز على الموقع إن لم نفعل بعد. التركيز على حاوية بلا حجم يضع الخريطة خطأً.
        observer = new ResizeObserver(() => {
          google.maps.event.trigger(map, "resize");
          if (!centeredRef.current && boundsRef.current && container.clientWidth > 0) {
            fitBoundsCapped(map, boundsRef.current);
            centeredRef.current = true;
          }
        });
        observer.observe(container);

        setMapState({ map, libs });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      observer?.disconnect();
      setMapState(null);
      // كل خريطة تُنشأ داخل الحاوية نفسها، فنفرغها كي لا تتراكم الخرائط.
      container.replaceChildren();
    };
  }, [readOnly]);

  // العلامة والدائرة تُنشآن مع كل خريطة وتُزالان معها، ثم تتبعان القيم بالمزامنة أدناه.
  useEffect(() => {
    if (!mapState) return;
    const { map, libs } = mapState;

    const marker = new libs.marker.AdvancedMarkerElement({
      map,
      content: createMarkerElement(),
      // الدائرة الصغيرة مُحاذاة بمركزها لا بأسفلها، فتقع النقطة تماماً على الموقع.
      anchorLeft: "-50%",
      anchorTop: "-50%",
      gmpDraggable: false,
      gmpClickable: false,
    });
    marker.addEventListener("gmp-dragend", () => {
      const moved = toLatLng(marker.position);
      if (moved) onChangeRef.current?.(moved);
    });

    const circle = new libs.maps.Circle({
      map,
      center: DEFAULT_CENTER,
      radius: 0,
      visible: false,
      strokeColor: "#bf3c3c",
      strokeWeight: 2,
      fillColor: "#fec55f",
      fillOpacity: 0.25,
      clickable: false,
    });

    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      marker.map = null;
      circle.setMap(null);
      markerRef.current = null;
      circleRef.current = null;
      boundsRef.current = null;
      centeredRef.current = false;
    };
  }, [mapState]);

  // مزامنة العلامة والدائرة مع القيم الحالية.
  useEffect(() => {
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!mapState || !marker || !circle) return;

    marker.gmpDraggable = !readOnly;

    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      marker.position = null;
      circle.setVisible(false);
      boundsRef.current = null;
      return;
    }

    const point = { lat, lng };
    marker.position = point;

    // الدائرة تُرسم فقط حين يُمرَّر نطاق، فالخريطة التي تحدد الموقع وحده تبقى بلا دائرة.
    if (radiusKm === null || radiusKm === undefined) {
      circle.setVisible(false);
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(point);
      boundsRef.current = bounds;
    } else {
      circle.setCenter(point);
      circle.setRadius(Math.max(0, radiusKm * 1000));
      circle.setVisible(true);
      boundsRef.current = circle.getBounds() ?? null;
    }

    // أول مرة يظهر فيها موقع محفوظ: نركّز الخريطة على الدائرة كلها إن وُجدت، أو على الموقع، بشرط أن تكون الحاوية ظاهرة.
    const container = containerRef.current;
    if (!centeredRef.current && boundsRef.current && container && container.clientWidth > 0) {
      google.maps.event.trigger(mapState.map, "resize");
      fitBoundsCapped(mapState.map, boundsRef.current);
      centeredRef.current = true;
    }
  }, [mapState, lat, lng, radiusKm, readOnly]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="map"
      className="w-full overflow-hidden rounded-2xl ring-1 ring-line"
      style={{ height }}
    />
  );
}
