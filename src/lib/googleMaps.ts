import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { env } from "@/config/env";

let optionsSet = false;

/**
 * يحمّل مكتبات Google Maps عند أول طلب، ثم يعيد الحزم نفسها في كل طلب لاحق.
 * يرفض إن لم يُضبط المفتاح، فيتولى المستدعي إظهار حالة بديلة.
 */
export const loadGoogleMaps = async () => {
  if (!env.googleMapsApiKey) throw new Error("VITE_GOOGLE_MAPS_API_KEY is not set");

  if (!optionsSet) {
    setOptions({ key: env.googleMapsApiKey });
    optionsSet = true;
  }

  const [maps, marker, places] = await Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
    importLibrary("places"),
  ]);

  return { maps, marker, places };
};

export type GoogleMapsLibraries = Awaited<ReturnType<typeof loadGoogleMaps>>;

/** يحوّل أي صيغة إحداثيات تعيدها Google Maps إلى { lat, lng } عادي. */
export const toLatLng = (
  point: google.maps.LatLng | google.maps.LatLngLiteral | google.maps.LatLngAltitude | google.maps.LatLngAltitudeLiteral | null | undefined
) => {
  if (!point) return null;
  if (point instanceof google.maps.LatLng) {
    return { lat: point.lat(), lng: point.lng() };
  }
  return { lat: point.lat, lng: point.lng };
};
