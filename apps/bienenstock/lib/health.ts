import { z } from "zod";

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal("bienenstock"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export function healthResponse(): HealthResponse {
  return healthResponseSchema.parse({
    ok: true,
    service: "bienenstock",
  });
}
