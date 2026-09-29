import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError } from "@/server/http";
import { getNumberSetting } from "@/server/settings";

// GET /api/store/settings → public store settings the storefront/checkout display
export async function GET() {
  try {
    return NextResponse.json({
      currency: "PKR",
      shippingFee: await getNumberSetting(db, "shipping_fee"),
      paymentMethods: ["COD", "JAZZCASH"],
    });
  } catch (e) {
    return handleError(e);
  }
}
