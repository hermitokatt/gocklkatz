import { NextResponse } from "next/server";

import {
  getRadicalDetail,
  RadicalIdParamSchema,
} from "@/lib/radicals";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const parsedId = RadicalIdParamSchema.safeParse(id);

  if (!parsedId.success) {
    return NextResponse.json(
      { error: "Invalid radical id" },
      { status: 400 },
    );
  }

  const detail = getRadicalDetail(parsedId.data);
  if (!detail) {
    return NextResponse.json({ error: "Radical not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
