import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHomeContent } from "@/server/content/homepage";
import { handleError } from "@/server/http";

// GET /api/store/home → { banner, promotion } for the homepage (either may be null = don't show).
export async function GET() {
  try {
    return NextResponse.json(await getHomeContent(db));
  } catch (e) {
    return handleError(e);
  }
}
