import { z } from "zod";
import { citySchema } from "./fixture";

/** Canonical undirected edge id (`min:max`) as stored on the colony. */
export const edgeKeySchema = z
  .string()
  .regex(/^\d+:\d+$/, "edge key must be min:max city indices")
  .refine((key) => {
    const [left, right] = key.split(":").map(Number);
    return Number.isInteger(left) && Number.isInteger(right) && left! < right!;
  }, "edge key must use ascending distinct city indices");

export const antSchema = z.object({
  id: z.number().int().nonnegative(),
  tour: z.array(z.number().int().nonnegative()),
});

/** Tunable ACO knobs exposed on the DualAB-A HTTP façade. */
export const simParamsSchema = z.object({
  alpha: z.number().finite().nonnegative(),
  beta: z.number().finite().nonnegative(),
  rho: z.number().finite().gt(0).lte(1),
  antCount: z.number().int().positive().max(200),
});

export type SimParamsInput = z.infer<typeof simParamsSchema>;

/** Optional blocked-edge set when already present in colony state. */
export const simParamsRequestSchema = simParamsSchema.extend({
  blockedEdges: z.array(edgeKeySchema).optional(),
});

export type SimParamsRequest = z.infer<typeof simParamsRequestSchema>;

export const acoParamsSchema = simParamsSchema.extend({
  q: z.number().finite().positive(),
  tau0: z.number().finite().positive(),
});

export const simSnapshotSchema = z.object({
  cities: z.array(citySchema).min(2),
  params: acoParamsSchema,
  iteration: z.number().int().nonnegative(),
  bestTour: z.array(z.number().int().nonnegative()).nullable(),
  /** `null` when no valid best-so-far (e.g. after chaos invalidated gold). */
  bestLength: z.number().finite().positive().nullable(),
  ants: z.array(antSchema),
  blockedEdges: z.array(edgeKeySchema),
  tau: z.array(z.array(z.number().finite().nonnegative())),
});

export type SimSnapshot = z.infer<typeof simSnapshotSchema>;

export const stepRequestSchema = z.object({
  iterations: z.number().int().positive().max(500),
});

export type StepRequest = z.infer<typeof stepRequestSchema>;

export const stepResultSchema = z.object({
  iterationsAdvanced: z.number().int().nonnegative(),
  snapshot: simSnapshotSchema,
});

export type StepResult = z.infer<typeof stepResultSchema>;

export const apiErrorSchema = z.object({
  error: z.literal("validation_failed"),
  issues: z.array(
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  ),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
