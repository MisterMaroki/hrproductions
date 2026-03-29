import { db } from "@/lib/db";
import { services, serviceCategories, serviceBrandOverrides } from "@/lib/schema";
import { eq, asc, and } from "drizzle-orm";
import type { BrandMode } from "@/lib/brand";
import type { PricingRules, DurationRules, InputField } from "@/lib/pricing-engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedService {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  pricingRules: PricingRules;
  durationRules: DurationRules;
  inputFields: InputField[];
  isAddon: boolean;
  parentServiceId: string | null;
  sortOrder: number;
}

export interface ResolvedCategory {
  id: string;
  name: string;
  sortOrder: number;
  services: ResolvedService[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ServiceRow = typeof services.$inferSelect;
type OverrideRow = typeof serviceBrandOverrides.$inferSelect;
type CategoryRow = typeof serviceCategories.$inferSelect;

function resolveService(
  service: ServiceRow,
  override: OverrideRow | undefined,
  categoryName: string
): ResolvedService {
  return {
    id: service.id,
    categoryId: service.categoryId,
    categoryName,
    name: service.name,
    description: service.description ?? null,
    pricingRules: JSON.parse(
      (override?.pricingRules ?? null) || service.pricingRules
    ) as PricingRules,
    durationRules: JSON.parse(
      (override?.durationRules ?? null) || service.durationRules
    ) as DurationRules,
    inputFields: JSON.parse(
      (override?.inputFields ?? null) || service.inputFields
    ) as InputField[],
    isAddon: service.isAddon === 1,
    parentServiceId: service.parentServiceId ?? null,
    sortOrder: service.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// getServicesForBrand
// ---------------------------------------------------------------------------

export async function getServicesForBrand(
  brandMode: BrandMode
): Promise<ResolvedCategory[]> {
  const [allCategories, allServices, allOverrides] = await Promise.all([
    db
      .select()
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.sortOrder)),
    db
      .select()
      .from(services)
      .where(eq(services.visible, 1))
      .orderBy(asc(services.sortOrder)),
    db
      .select()
      .from(serviceBrandOverrides)
      .where(eq(serviceBrandOverrides.brandMode, brandMode)),
  ]);

  // Build a map of overrides keyed by serviceId for O(1) lookup
  const overrideMap = new Map<string, OverrideRow>();
  for (const override of allOverrides) {
    overrideMap.set(override.serviceId, override);
  }

  // Build a map of categories keyed by id
  const categoryMap = new Map<string, CategoryRow>();
  for (const category of allCategories) {
    categoryMap.set(category.id, category);
  }

  // Group resolved services by categoryId
  const categoryServices = new Map<string, ResolvedService[]>();

  for (const service of allServices) {
    const override = overrideMap.get(service.id);

    // If override explicitly hides this service, skip it
    if (override && override.visible === 0) {
      continue;
    }

    const category = categoryMap.get(service.categoryId);
    if (!category) continue;

    const resolved = resolveService(service, override, category.name);

    const bucket = categoryServices.get(service.categoryId);
    if (bucket) {
      bucket.push(resolved);
    } else {
      categoryServices.set(service.categoryId, [resolved]);
    }
  }

  // Build final sorted categories, filtering empty ones
  const result: ResolvedCategory[] = [];

  for (const category of allCategories) {
    const resolvedServices = categoryServices.get(category.id);
    if (!resolvedServices || resolvedServices.length === 0) continue;

    result.push({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      services: resolvedServices,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// getServiceById
// ---------------------------------------------------------------------------

export async function getServiceById(
  serviceId: string,
  brandMode: BrandMode
): Promise<ResolvedService | null> {
  const [serviceRows, overrideRows] = await Promise.all([
    db.select().from(services).where(eq(services.id, serviceId)).limit(1),
    db
      .select()
      .from(serviceBrandOverrides)
      .where(
        and(
          eq(serviceBrandOverrides.serviceId, serviceId),
          eq(serviceBrandOverrides.brandMode, brandMode)
        )
      )
      .limit(1),
  ]);

  const service = serviceRows[0];
  if (!service) return null;

  const override = overrideRows[0];

  // If override explicitly hides this service, treat as not found
  if (override && override.visible === 0) return null;

  const categoryRows = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.id, service.categoryId))
    .limit(1);

  const category = categoryRows[0];
  const categoryName = category?.name ?? "";

  return resolveService(service, override, categoryName);
}
