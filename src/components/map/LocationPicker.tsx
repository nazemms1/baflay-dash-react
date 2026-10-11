import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** وسط دمشق، يُستعمل حين لا يوجد موقع محفوظ بعد. */
const DEFAULT_CENTER: L.LatLngTuple = [33.5138, 36.2765];

export interface LatLng {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  /** نطاق التوصيل بالكيلومتر، يُرسم دائرةً حول النقطة. */
  radiusKm?: number | null;
  readOnly?: boolean;
  height?: string;
  onChange?: (point: LatLng) => void;
}

const markerIcon = L.divIcon({
  className: "",
  html: '<span class="block size-5 rounded-full bg-secondary ring-4 ring-primary shadow-lg"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/**
 * خريطة لتحديد موقع الفرع. النقر يضع العلامة، وسحبها يعدّل الموقع، والدائرة
 * تُظهر نطاق التوصيل وتتحدث مع الرقم مباشرة. في وضع القراءة تبقى الخريطة
 * للعرض فقط.
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
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centeredRef = useRef(false);
  // حدود الدائرة الحالية، فيُركَّز عليها متى صار للحاوية حجم حقيقي.
  const boundsRef = useRef<L.LatLngBounds | null>(null);

  // الاستدعاء يُحدَّث دون إعادة إنشاء الخريطة، فلا تتعلّق الأحداث بقيمة قديمة.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // إنشاء الخريطة مرة واحدة، وتدميرها عند الخروج.
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      dragging: !readOnly,
      touchZoom: !readOnly,
      doubleClickZoom: !readOnly,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    if (!readOnly) {
      map.on("click", (event) => onChangeRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng }));
    }

    mapRef.current = map;
    const container = containerRef.current;

    // الخريطة داخل نافذة تتحرك وتكبر لحظة فتحها: حين تأخذ الحاوية حجمها الحقيقي نُعيد رسم
    // الخريطة، ونركّز على الموقع إن لم نفعل بعد. التركيز على حاوية بلا حجم يضع الخريطة خطأً.
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!centeredRef.current && boundsRef.current && container.clientWidth > 0) {
        map.fitBounds(boundsRef.current, { padding: [24, 24], maxZoom: 15 });
        centeredRef.current = true;
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      boundsRef.current = null;
      centeredRef.current = false;
    };
  }, [readOnly]);

  // مزامنة العلامة والدائرة مع القيم الحالية.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    const point = L.latLng(lat, lng);
    const radiusMeters = Math.max(0, Number(radiusKm ?? 0) * 1000);

    if (!markerRef.current) {
      const marker = L.marker(point, { icon: markerIcon, draggable: !readOnly, interactive: !readOnly }).addTo(map);
      marker.on("dragend", () => {
        const moved = marker.getLatLng();
        onChangeRef.current?.({ lat: moved.lat, lng: moved.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(point);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(point, {
        radius: radiusMeters,
        color: "#bf3c3c",
        weight: 2,
        fillColor: "#fec55f",
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(point);
      circleRef.current.setRadius(radiusMeters);
    }

    // أول مرة يظهر فيها موقع محفوظ: نركّز الخريطة على الدائرة كلها، بشرط أن تكون الحاوية ظاهرة.
    boundsRef.current = circleRef.current.getBounds();
    const container = containerRef.current;
    if (!centeredRef.current && container && container.clientWidth > 0) {
      map.invalidateSize();
      map.fitBounds(boundsRef.current, { padding: [24, 24], maxZoom: 15 });
      centeredRef.current = true;
    }
  }, [lat, lng, radiusKm, readOnly]);

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
