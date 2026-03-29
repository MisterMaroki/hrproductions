import { db } from "@/lib/db";
import { serviceCategories, services } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function seedServices() {
  // Idempotency check — bail if categories already exist
  const existing = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.id, "cat-photography"));

  if (existing.length > 0) {
    console.log("Services already seeded — skipping.");
    return;
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  await db.insert(serviceCategories).values([
    { id: "cat-photography", name: "Photography", sortOrder: 0 },
    { id: "cat-video", name: "Video", sortOrder: 1 },
    { id: "cat-floorplans", name: "Floor Plans", sortOrder: 2 },
  ]);

  // ── Services ───────────────────────────────────────────────────────────────
  await db.insert(services).values([
    // Photography
    {
      id: "svc-photography",
      categoryId: "cat-photography",
      name: "Photography",
      pricingRules: JSON.stringify({
        basePrice: 0,
        rules: [
          { type: "perUnit", input: "photos", rate: 6.5, freeUnits: 0 },
          { type: "minimum", input: "photos", minValue: 20 },
          { type: "bulkDiscount", input: "photos", threshold: 100, percent: 10 },
        ],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 40,
        scaling: { input: "photos", rate: 5, freeUnits: 20 },
      }),
      inputFields: JSON.stringify([
        { key: "photos", label: "Number of Photos", type: "number", min: 20, max: 500, default: 20 },
      ]),
      isAddon: 0,
      sortOrder: 0,
      visible: 1,
    },
    {
      id: "svc-drone-photography",
      categoryId: "cat-photography",
      name: "Drone Photography",
      pricingRules: JSON.stringify({
        basePrice: 0,
        rules: [
          {
            type: "fixedTier",
            tiers: [
              { label: "8 photos — £75", value: "8", price: 75 },
              { label: "20 photos — £140", value: "20", price: 140 },
            ],
          },
        ],
      }),
      durationRules: JSON.stringify({ baseMinutes: 25 }),
      inputFields: JSON.stringify([
        {
          key: "package",
          label: "Package",
          type: "select",
          options: [
            { value: "8", label: "8 photos — £75" },
            { value: "20", label: "20 photos — £140" },
          ],
          default: "8",
        },
      ]),
      isAddon: 0,
      sortOrder: 1,
      visible: 1,
    },

    // Video
    {
      id: "svc-standard-video",
      categoryId: "cat-video",
      name: "Unpresented Property Video",
      pricingRules: JSON.stringify({
        basePrice: 100,
        rules: [{ type: "perUnit", input: "bedrooms", rate: 25, freeUnits: 2 }],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 40,
        scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
      }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      sortOrder: 0,
      visible: 1,
    },
    {
      id: "svc-standard-video-drone",
      categoryId: "cat-video",
      name: "Drone Footage",
      pricingRules: JSON.stringify({
        basePrice: 65,
        rules: [{ type: "flatRate" }],
      }),
      durationRules: JSON.stringify({ baseMinutes: 25 }),
      inputFields: JSON.stringify([]),
      isAddon: 1,
      parentServiceId: "svc-standard-video",
      sortOrder: 1,
      visible: 1,
    },
    {
      id: "svc-agent-presented-video",
      categoryId: "cat-video",
      name: "Agent Presented Video",
      pricingRules: JSON.stringify({
        basePrice: 225,
        rules: [{ type: "perUnit", input: "bedrooms", rate: 45, freeUnits: 2 }],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 105,
        scaling: { input: "bedrooms", rate: 10, freeUnits: 2 },
      }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      sortOrder: 2,
      visible: 1,
    },
    {
      id: "svc-agent-presented-video-drone",
      categoryId: "cat-video",
      name: "Drone Footage",
      pricingRules: JSON.stringify({
        basePrice: 65,
        rules: [{ type: "flatRate" }],
      }),
      durationRules: JSON.stringify({ baseMinutes: 25 }),
      inputFields: JSON.stringify([]),
      isAddon: 1,
      parentServiceId: "svc-agent-presented-video",
      sortOrder: 3,
      visible: 1,
    },
    {
      id: "svc-social-media-video",
      categoryId: "cat-video",
      name: "Social Media Video (Unpresented)",
      pricingRules: JSON.stringify({
        basePrice: 100,
        rules: [{ type: "perUnit", input: "bedrooms", rate: 25, freeUnits: 2 }],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 25,
        scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
      }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      sortOrder: 4,
      visible: 1,
    },
    {
      id: "svc-social-media-presented-video",
      categoryId: "cat-video",
      name: "Social Media Video (Presented)",
      pricingRules: JSON.stringify({
        basePrice: 200,
        rules: [{ type: "perUnit", input: "bedrooms", rate: 30, freeUnits: 2 }],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 60,
        scaling: { input: "bedrooms", rate: 10, freeUnits: 2 },
      }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      sortOrder: 5,
      visible: 1,
    },

    // Floor Plans
    {
      id: "svc-standard-floor-plan",
      categoryId: "cat-floorplans",
      name: "Standard Floor Plan",
      pricingRules: JSON.stringify({
        basePrice: 60,
        rules: [{ type: "perUnit", input: "bedrooms", rate: 20, freeUnits: 2 }],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 25,
        scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
      }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      sortOrder: 0,
      visible: 1,
    },
    {
      id: "svc-premium-floor-plan",
      categoryId: "cat-floorplans",
      name: "Premium Floor Plan",
      pricingRules: JSON.stringify({
        basePrice: 80,
        rules: [{ type: "perUnit", input: "bedrooms", rate: 20, freeUnits: 2 }],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 25,
        scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
      }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      sortOrder: 1,
      visible: 1,
    },
    {
      id: "svc-3d-floor-plan",
      categoryId: "cat-floorplans",
      name: "3D Floor Plan",
      pricingRules: JSON.stringify({
        basePrice: 150,
        rules: [{ type: "perUnit", input: "bedrooms", rate: 20, freeUnits: 2 }],
      }),
      durationRules: JSON.stringify({
        baseMinutes: 25,
        scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
      }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      sortOrder: 2,
      visible: 1,
    },
  ]);

  console.log("Seeded 3 categories and 11 services.");
}
