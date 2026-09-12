import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Env name only — never commit a real value. Documented in `.env.example` + `docs/DEPLOY.md`. */
export const AMEISEN_MUTATE_SECRET_ENV = "AMEISEN_MUTATE_SECRET";

export const mutateForbiddenSchema = z.object({
  error: z.literal("mutate_forbidden"),
  message: z.string().min(1),
});

export type MutateForbidden = z.infer<typeof mutateForbiddenSchema>;

function forbidden(message: string): NextResponse {
  return NextResponse.json(
    mutateForbiddenSchema.parse({
      error: "mutate_forbidden",
      message,
    }),
    { status: 403 },
  );
}

function secretsEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Fail-closed DualAB-A mutate gate for shared-server write routes.
 *
 * - Env unset / empty → 403 (production default; no anonymous colony mutation)
 * - Env set → require `Authorization: Bearer <secret>`; wrong/missing → 403
 * - Returns `null` when the write may proceed
 */
export function assertMutateAllowed(request: Request): NextResponse | null {
  const secret = process.env[AMEISEN_MUTATE_SECRET_ENV]?.trim() ?? "";
  if (secret.length === 0) {
    return forbidden(`${AMEISEN_MUTATE_SECRET_ENV} is unset; DualAB-A mutate routes are closed`);
  }

  const header = request.headers.get("authorization");
  if (header === null || header.length === 0) {
    return forbidden("Authorization Bearer secret required for DualAB-A mutate");
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) {
    return forbidden("Authorization must be Bearer <secret>");
  }

  const provided = match[1]!;
  if (!secretsEqual(secret, provided)) {
    return forbidden("Bearer secret does not match");
  }

  return null;
}
