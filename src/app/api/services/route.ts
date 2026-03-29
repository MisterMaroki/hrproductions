import { NextResponse } from "next/server";
import { getServicesForBrand } from "@/lib/services";
import { getBrandMode } from "@/lib/brand";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand");
  const brandMode =
    brand === "whitelabel"
      ? "whitelabel"
      : brand === "main"
      ? "main"
      : getBrandMode();
  const categories = await getServicesForBrand(brandMode);
  return NextResponse.json(categories);
}
