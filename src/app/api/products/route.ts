import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { listProducts } from "@/server/catalog/catalog";
import { handleError } from "@/server/http";

// GET /api/products?category=earrings&q=pearl&finish=gold&colour=Blue&minPrice=&maxPrice=
//                   &inStock=true&newArrivals=true&sort=newest|price_asc|price_desc|name&page=1&pageSize=24
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await listProducts(db, Object.fromEntries(req.nextUrl.searchParams)));
  } catch (e) {
    return handleError(e);
  }
}
