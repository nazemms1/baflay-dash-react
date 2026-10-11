import type { RawBilingual } from "@/lib/localized";
import { createResource } from "./resource";

/** سجل جغرافي كما يأتي من الخادم، بحقول الاسم الخام. */
export interface GeoEntity extends RawBilingual {
  id: number;
  [field: string]: unknown;
}

export const countries = createResource<GeoEntity>("countries");
export const states = createResource<GeoEntity>("states");
export const cities = createResource<GeoEntity>("cities");
