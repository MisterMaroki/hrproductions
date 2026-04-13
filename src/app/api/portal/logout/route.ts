import { NextResponse } from "next/server";
import { clearClientSessionCookie } from "@/lib/client-auth";
import { clearWhitelabelSessionCookie } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";

export async function POST() {
  if (isWhiteLabel()) {
    await clearWhitelabelSessionCookie();
  } else {
    await clearClientSessionCookie();
  }
  return NextResponse.json({ success: true });
}
