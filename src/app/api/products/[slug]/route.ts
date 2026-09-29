import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getProductDetail } from "@/server/catalog/catalog";
import { errorResponse, handleError } from "@/server/http";

// GET /api/products/aveline-pearl-drop-ear-001 → product page data incl. Finish → Colour → Size options
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/products/[slug]">) {
  try {
    const { slug } = await ctx.params;
    const product = await getProductDetail(db, slug);
    if (!product) return errorResponse("NOT_FOUND", "Product not found");
    return NextResponse.json(product);
  } catch (e) {
    return handleError(e);
  }
}
