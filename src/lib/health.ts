import { z } from "zod";

/** The contract `GET /api/health` answers with. Both fields are fixed by ticket 001. */
export const healthSchema = z.object({
  ok: z.literal(true),
  service: z.literal("gocklkatz"),
});

export type Health = z.infer<typeof healthSchema>;

/**
 * Built through the schema so the route cannot answer with a shape the contract does not
 * describe: a typo here fails the parse instead of shipping a wrong body.
 */
export function healthPayload(): Health {
  return healthSchema.parse({ ok: true, service: "gocklkatz" });
}
