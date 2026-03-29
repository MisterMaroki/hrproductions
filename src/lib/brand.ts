export type BrandMode = "main" | "whitelabel";

export function getBrandMode(): BrandMode {
  // Check both server-side and client-side env vars
  const mode = process.env.NEXT_PUBLIC_BRAND_MODE || process.env.BRAND_MODE;
  return (mode as BrandMode) || "main";
}

export function isWhiteLabel(): boolean {
  return getBrandMode() === "whitelabel";
}
