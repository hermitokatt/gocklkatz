import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/ameisen/sim";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getSnapshot());
}
