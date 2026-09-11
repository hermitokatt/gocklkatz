import { NextResponse } from "next/server";
import { assertMutateAllowed } from "@/lib/ameisen/mutate-gate";
import { invokeTool } from "@/lib/ameisen/tools";

export const dynamic = "force-dynamic";

/**
 * DualAB-A tool surface: `{ tool, args? }` → allowlisted sim helpers only.
 * Unknown tools are refused; invalid args write nothing (Zod via sim façade).
 * Entire route is gated (includes read tools) — shared-server colony writes
 * live behind the same Bearer secret as params/step; use GET snapshot publicly.
 */
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

  const outcome = invokeTool(raw);
  if (!outcome.ok) {
    return NextResponse.json(outcome.body, { status: outcome.status });
  }

  return NextResponse.json({
    tool: outcome.tool,
    result: outcome.result,
  });
}
