import { NextResponse } from "next/server";

import { listRadicals } from "@/lib/radicals";

export async function GET() {
  return NextResponse.json(listRadicals());
}
