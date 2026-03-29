import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { services, serviceCategories, serviceBrandOverrides } from "@/lib/schema";
import { eq, asc, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Case 1: Upsert a brand override
    if (body.brandOverride) {
      const { brandMode, visible, pricingRules, durationRules, inputFields } =
        body.brandOverride;

      const existing = await db
        .select()
        .from(serviceBrandOverrides)
        .where(
          and(
            eq(serviceBrandOverrides.serviceId, id),
            eq(serviceBrandOverrides.brandMode, brandMode)
          )
        )
        .limit(1);

      const overrideData = {
        visible: visible ?? 1,
        pricingRules: pricingRules != null ? JSON.stringify(pricingRules) : null,
        durationRules: durationRules != null ? JSON.stringify(durationRules) : null,
        inputFields: inputFields != null ? JSON.stringify(inputFields) : null,
      };

      if (existing.length > 0) {
        await db
          .update(serviceBrandOverrides)
          .set(overrideData)
          .where(
            and(
              eq(serviceBrandOverrides.serviceId, id),
              eq(serviceBrandOverrides.brandMode, brandMode)
            )
          );
      } else {
        await db.insert(serviceBrandOverrides).values({
          id: crypto.randomUUID(),
          serviceId: id,
          brandMode,
          ...overrideData,
        });
      }

      return NextResponse.json({ success: true });
    }

    // Case 2: Remove a brand override
    if (body.removeBrandOverride) {
      const { brandMode } = body.removeBrandOverride;

      await db
        .delete(serviceBrandOverrides)
        .where(
          and(
            eq(serviceBrandOverrides.serviceId, id),
            eq(serviceBrandOverrides.brandMode, brandMode)
          )
        );

      return NextResponse.json({ success: true });
    }

    // Case 3: Regular service update
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.description !== undefined) updates.description = body.description;
    if (body.pricingRules !== undefined)
      updates.pricingRules = JSON.stringify(body.pricingRules);
    if (body.durationRules !== undefined)
      updates.durationRules = JSON.stringify(body.durationRules);
    if (body.inputFields !== undefined)
      updates.inputFields = JSON.stringify(body.inputFields);
    if (body.isAddon !== undefined) updates.isAddon = body.isAddon;
    if (body.parentServiceId !== undefined)
      updates.parentServiceId = body.parentServiceId;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.visible !== undefined) updates.visible = body.visible;
    updates.updatedAt = new Date().toISOString();

    await db.update(services).set(updates).where(eq(services.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update service error:", err);
    return NextResponse.json(
      { error: "Failed to update service" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete overrides first, then the service itself
    await db
      .delete(serviceBrandOverrides)
      .where(eq(serviceBrandOverrides.serviceId, id));
    await db.delete(services).where(eq(services.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete service error:", err);
    return NextResponse.json(
      { error: "Failed to delete service" },
      { status: 500 }
    );
  }
}
