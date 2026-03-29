import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { services, serviceCategories, serviceBrandOverrides } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const [allCategories, allServices, allOverrides] = await Promise.all([
    db
      .select()
      .from(serviceCategories)
      .orderBy(asc(serviceCategories.sortOrder)),
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(serviceBrandOverrides),
  ]);

  // Group overrides by serviceId
  const overridesByService = new Map<
    string,
    (typeof serviceBrandOverrides.$inferSelect)[]
  >();
  for (const override of allOverrides) {
    const bucket = overridesByService.get(override.serviceId);
    if (bucket) {
      bucket.push(override);
    } else {
      overridesByService.set(override.serviceId, [override]);
    }
  }

  // Group services by categoryId
  const servicesByCategory = new Map<
    string,
    (typeof services.$inferSelect)[]
  >();
  for (const service of allServices) {
    const bucket = servicesByCategory.get(service.categoryId);
    if (bucket) {
      bucket.push(service);
    } else {
      servicesByCategory.set(service.categoryId, [service]);
    }
  }

  const result = allCategories.map((category) => {
    const categoryServices = servicesByCategory.get(category.id) ?? [];

    return {
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      services: categoryServices.map((service) => {
        const overrides = overridesByService.get(service.id) ?? [];

        return {
          id: service.id,
          name: service.name,
          description: service.description,
          pricingRules: JSON.parse(service.pricingRules),
          durationRules: JSON.parse(service.durationRules),
          inputFields: JSON.parse(service.inputFields),
          isAddon: service.isAddon,
          parentServiceId: service.parentServiceId,
          sortOrder: service.sortOrder,
          visible: service.visible,
          categoryId: service.categoryId,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt,
          overrides: overrides.map((o) => ({
            id: o.id,
            brandMode: o.brandMode,
            visible: o.visible,
            pricingRules: o.pricingRules != null ? JSON.parse(o.pricingRules) : null,
            durationRules: o.durationRules != null ? JSON.parse(o.durationRules) : null,
            inputFields: o.inputFields != null ? JSON.parse(o.inputFields) : null,
          })),
        };
      }),
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    const {
      name,
      categoryId,
      pricingRules,
      durationRules,
      description,
      inputFields,
      isAddon,
      parentServiceId,
      sortOrder,
    } = await request.json();

    if (!name || !categoryId || !pricingRules || !durationRules) {
      return NextResponse.json(
        { error: "name, categoryId, pricingRules, and durationRules are required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(services).values({
      id,
      name,
      categoryId,
      pricingRules: JSON.stringify(pricingRules),
      durationRules: JSON.stringify(durationRules),
      description: description ?? null,
      inputFields: JSON.stringify(inputFields ?? []),
      isAddon: isAddon ?? 0,
      parentServiceId: parentServiceId ?? null,
      sortOrder: sortOrder ?? 0,
    });

    return NextResponse.json({ id, name }, { status: 201 });
  } catch (err) {
    console.error("Create service error:", err);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    );
  }
}
