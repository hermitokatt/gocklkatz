import { z } from "zod";

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("simplified"),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export function getHealthResponse(): HealthResponse {
  return HealthResponseSchema.parse({
    ok: true,
    service: "simplified",
  });
}
