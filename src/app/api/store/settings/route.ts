import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleError } from "@/server/http";
import { getNumberSetting, getStoreDetails } from "@/server/settings";

// GET /api/store/settings → public store settings the storefront/checkout display
export async function GET() {
  try {
    const [shippingFee, details] = await Promise.all([getNumberSetting(db, "shipping_fee"), getStoreDetails(db)]);
    return NextResponse.json({
      currency: "PKR",
      shippingFee,
      paymentMethods: ["COD", "JAZZCASH"],
      ...details,
    });
  } catch (e) {
    return handleError(e);
  }
}
