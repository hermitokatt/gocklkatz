import { z } from "zod";
import { apiErrorSchema, simParamsRequestSchema, stepRequestSchema } from "./api-schemas";
import { citySchema } from "./fixture";

/** DualAB-A allowlist — only these names may mutate or read the live colony via tools. */
export const ALLOWED_TOOL_NAMES = ["getTrail", "getBestTour", "setParams", "step"] as const;

export type AllowedToolName = (typeof ALLOWED_TOOL_NAMES)[number];

export const allowedToolNameSchema = z.enum(ALLOWED_TOOL_NAMES);

/** Wire request: tool name is a free string so unknown names can be refused clearly. */
export const toolCallRequestSchema = z.object({
  tool: z.string().min(1),
  args: z.unknown().optional(),
});

export type ToolCallRequest = z.infer<typeof toolCallRequestSchema>;

export const getTrailArgsSchema = z.object({}).strict();
export const getBestTourArgsSchema = z.object({}).strict();
export const setParamsArgsSchema = simParamsRequestSchema;
export const stepArgsSchema = stepRequestSchema;

export const trailResultSchema = z.object({
  iteration: z.number().int().nonnegative(),
  cities: z.array(citySchema),
  tau: z.array(z.array(z.number().finite().nonnegative())),
  blockedEdges: z.array(z.string()),
});

export type TrailResult = z.infer<typeof trailResultSchema>;

export const bestTourResultSchema = z.object({
  bestTour: z.array(z.number().int().nonnegative()).nullable(),
  bestLength: z.number().finite().positive().nullable(),
  iteration: z.number().int().nonnegative(),
});

export type BestTourResult = z.infer<typeof bestTourResultSchema>;

/** Clear refuse when the name is not on the allowlist (no silent invent). */
export const toolRefusedSchema = z.object({
  error: z.literal("tool_refused"),
  tool: z.string(),
  reason: z.string(),
  allowlist: z.array(z.string()),
});

export type ToolRefused = z.infer<typeof toolRefusedSchema>;

export const toolValidationErrorSchema = apiErrorSchema;
export type ToolValidationError = z.infer<typeof toolValidationErrorSchema>;
