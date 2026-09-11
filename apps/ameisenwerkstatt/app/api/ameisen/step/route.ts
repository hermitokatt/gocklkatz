import { NextResponse } from "next/server";
import { assertMutateAllowed } from "@/lib/ameisen/mutate-gate";
import { advanceSteps } from "@/lib/ameisen/sim";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = assertMutateAllowed(request);
  if (denied) {
    return denied;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: [{ path: "(root)", message: "body must be JSON" }],
      },
      { status: 400 },
    );
  }

  const outcome = advanceSteps(raw);
  if (!outcome.ok) {
    return NextResponse.json(outcome.body, { status: outcome.status });
  }
  return NextResponse.json(outcome.result);
}
