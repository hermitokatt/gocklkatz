import {
  RadicalDetailResponseSchema,
  RadicalIdParamSchema,
  RadicalListResponseSchema,
  type Radical,
  type RadicalDetailResponse,
  type RadicalListResponse,
} from "./schema";
import { RADICALS } from "./seed";

/** List seed radicals sorted by ascending pedagogical `order`. */
export function listRadicals(): RadicalListResponse {
  const radicals = RADICALS.slice().sort((a, b) => a.order - b.order);
  return RadicalListResponseSchema.parse({ radicals });
}

/**
 * Look up one radical by id.
 * Callers that need 400 vs 404 must validate with `RadicalIdParamSchema` first
 * (as the route handler does). Invalid or unknown ids both yield `undefined`.
 */
export function getRadicalById(id: string): Radical | undefined {
  const parsedId = RadicalIdParamSchema.safeParse(id);
  if (!parsedId.success) {
    return undefined;
  }

  return RADICALS.find((radical) => radical.id === parsedId.data);
}

/**
 * Detail wrapper around `getRadicalById`.
 * Invalid or unknown ids both yield `undefined` — use schema validation for 400.
 */
export function getRadicalDetail(id: string): RadicalDetailResponse | undefined {
  const radical = getRadicalById(id);
  if (!radical) {
    return undefined;
  }

  return RadicalDetailResponseSchema.parse({ radical });
}

export {
  RadicalDetailResponseSchema,
  RadicalExampleSchema,
  RadicalIdParamSchema,
  RadicalListResponseSchema,
  RadicalSchema,
  type Radical,
  type RadicalDetailResponse,
  type RadicalExample,
  type RadicalListResponse,
} from "./schema";
export { RADICALS } from "./seed";
