import { z } from "zod";

/** Example character that uses a radical / meaning component. */
export const RadicalExampleSchema = z.object({
  char: z.string().min(1),
  pinyin: z.string().min(1).optional(),
  gloss: z.string().min(1),
});

/** One curated meaning component / radical in the MVP seed. */
export const RadicalSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9-]*$/, "id must be a lowercase slug"),
  forms: z.array(z.string().min(1)).min(1),
  gloss: z.string().min(1),
  pinyin: z.string().min(1).optional(),
  variantsNote: z.string().min(1).optional(),
  examples: z.array(RadicalExampleSchema).min(1),
  order: z.number().int().positive(),
});

export const RadicalListResponseSchema = z.object({
  radicals: z.array(RadicalSchema),
});

export const RadicalDetailResponseSchema = z.object({
  radical: RadicalSchema,
});

export const RadicalIdParamSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/, "id must be a lowercase slug");

export type RadicalExample = z.infer<typeof RadicalExampleSchema>;
export type Radical = z.infer<typeof RadicalSchema>;
export type RadicalListResponse = z.infer<typeof RadicalListResponseSchema>;
export type RadicalDetailResponse = z.infer<typeof RadicalDetailResponseSchema>;
