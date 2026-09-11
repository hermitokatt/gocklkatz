import { NextResponse } from "next/server";
import { healthResponse } from "@/lib/health";

export function GET() {
  return NextResponse.json(healthResponse());
}
