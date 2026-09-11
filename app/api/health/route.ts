import { healthPayload } from "@/lib/health";

export function GET() {
  return Response.json(healthPayload());
}
