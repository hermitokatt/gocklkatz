import { NextResponse } from "next/server";

import { getHealthResponse } from "@/lib/health";

export async function GET() {
  return NextResponse.json(getHealthResponse());
}
