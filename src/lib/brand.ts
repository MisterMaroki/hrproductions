export type BrandMode = "main" | "whitelabel";

export function getBrandMode(): BrandMode {
  return (process.env.NEXT_PUBLIC_BRAND_MODE as BrandMode) || "main";
}

export function isWhiteLabel(): boolean {
  return getBrandMode() === "whitelabel";
}
