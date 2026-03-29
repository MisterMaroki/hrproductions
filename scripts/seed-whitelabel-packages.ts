import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { serviceCategories, services, serviceBrandOverrides } from "../src/lib/schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client);

const PACKAGES_CAT_ID = "cat-wl-packages";
const ADDONS_CAT_ID = "cat-wl-addons";

async function seed() {
  // Create categories
  await db.insert(serviceCategories).values([
    { id: PACKAGES_CAT_ID, name: "Packages", sortOrder: 10 },
    { id: ADDONS_CAT_ID, name: "Add-Ons", sortOrder: 11 },
  ]);

  // All packages include 20 photos + £4/extra photo + £25/extra bedroom (above 3)
  const photoAndBedroomRules = [
    { type: "perUnit", input: "bedrooms", rate: 25, freeUnits: 3 },
    { type: "perUnit", input: "photos", rate: 4, freeUnits: 20 },
    { type: "minimum", input: "photos", minValue: 20 },
  ];

  const photoInput = [
    { key: "photos", label: "Number of Photos", type: "number", min: 20, max: 200, default: 20 },
  ];

  const packageServices = [
    {
      id: "svc-wl-premium-full",
      categoryId: PACKAGES_CAT_ID,
      name: "Premium Full Package",
      description: "Presented Video + Presented Social Media Video + 20 Photos + Floorplan",
      pricingRules: JSON.stringify({
        basePrice: 330,
        rules: photoAndBedroomRules,
      }),
      durationRules: JSON.stringify({ baseMinutes: 150, scaling: { input: "bedrooms", rate: 10, freeUnits: 3 } }),
      inputFields: JSON.stringify(photoInput),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 0,
      visible: 0, // globally hidden (whitelabel only)
    },
    {
      id: "svc-wl-presented-video",
      categoryId: PACKAGES_CAT_ID,
      name: "Presented Video Package",
      description: "Presented Video + 20 Photos + Floorplan",
      pricingRules: JSON.stringify({
        basePrice: 280,
        rules: photoAndBedroomRules,
      }),
      durationRules: JSON.stringify({ baseMinutes: 130, scaling: { input: "bedrooms", rate: 10, freeUnits: 3 } }),
      inputFields: JSON.stringify(photoInput),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 1,
      visible: 0,
    },
    {
      id: "svc-wl-standard-plus",
      categoryId: PACKAGES_CAT_ID,
      name: "Standard Plus Package",
      description: "Unpresented Video + Unpresented Social Media Video + 20 Photos + Floorplan",
      pricingRules: JSON.stringify({
        basePrice: 230,
        rules: photoAndBedroomRules,
      }),
      durationRules: JSON.stringify({ baseMinutes: 100, scaling: { input: "bedrooms", rate: 5, freeUnits: 3 } }),
      inputFields: JSON.stringify(photoInput),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 2,
      visible: 0,
    },
    {
      id: "svc-wl-standard",
      categoryId: PACKAGES_CAT_ID,
      name: "Standard Package",
      description: "Unpresented Video + 20 Photos + Floorplan",
      pricingRules: JSON.stringify({
        basePrice: 205,
        rules: photoAndBedroomRules,
      }),
      durationRules: JSON.stringify({ baseMinutes: 80, scaling: { input: "bedrooms", rate: 5, freeUnits: 3 } }),
      inputFields: JSON.stringify(photoInput),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 3,
      visible: 0,
    },
    {
      id: "svc-wl-informative-video",
      categoryId: PACKAGES_CAT_ID,
      name: "Informative Video",
      description: "Office/location based content (no photography)",
      pricingRules: JSON.stringify({
        basePrice: 150,
        rules: [
          { type: "perUnit", input: "bedrooms", rate: 25, freeUnits: 3 },
        ],
      }),
      durationRules: JSON.stringify({ baseMinutes: 60, scaling: { input: "bedrooms", rate: 5, freeUnits: 3 } }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 4,
      visible: 0,
    },
    {
      id: "svc-wl-photography-only",
      categoryId: PACKAGES_CAT_ID,
      name: "Photography Only",
      description: "20 Photos + Floorplan",
      pricingRules: JSON.stringify({
        basePrice: 80,
        rules: [
          { type: "perUnit", input: "bedrooms", rate: 25, freeUnits: 3 },
          { type: "perUnit", input: "photos", rate: 4, freeUnits: 20 },
          { type: "minimum", input: "photos", minValue: 20 },
        ],
      }),
      durationRules: JSON.stringify({ baseMinutes: 50, scaling: { input: "photos", rate: 2, freeUnits: 20 } }),
      inputFields: JSON.stringify(photoInput),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 5,
      visible: 0,
    },
  ];

  const addonServices = [
    {
      id: "svc-wl-drone-photography",
      categoryId: ADDONS_CAT_ID,
      name: "Drone Photography",
      description: "6 aerial images",
      pricingRules: JSON.stringify({ basePrice: 25, rules: [{ type: "flatRate" }] }),
      durationRules: JSON.stringify({ baseMinutes: 25 }),
      inputFields: JSON.stringify([]),
      isAddon: 0, // standalone add-on, not tied to a specific package
      parentServiceId: null,
      sortOrder: 0,
      visible: 0,
    },
    {
      id: "svc-wl-drone-video",
      categoryId: ADDONS_CAT_ID,
      name: "Drone Video",
      description: "Aerial video footage",
      pricingRules: JSON.stringify({ basePrice: 25, rules: [{ type: "flatRate" }] }),
      durationRules: JSON.stringify({ baseMinutes: 25 }),
      inputFields: JSON.stringify([]),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 1,
      visible: 0,
    },
    {
      id: "svc-wl-declutter",
      categoryId: ADDONS_CAT_ID,
      name: "Declutter",
      description: "Digital decluttering of rooms",
      pricingRules: JSON.stringify({
        basePrice: 0,
        rules: [{ type: "perUnit", input: "rooms", rate: 3, freeUnits: 0 }],
      }),
      durationRules: JSON.stringify({ baseMinutes: 0 }), // post-production, no on-site time
      inputFields: JSON.stringify([
        { key: "rooms", label: "Number of Rooms", type: "number", min: 1, max: 20, default: 1 },
      ]),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 2,
      visible: 0,
    },
    {
      id: "svc-wl-virtual-staging",
      categoryId: ADDONS_CAT_ID,
      name: "Virtual Staging",
      description: "Digitally staged rooms",
      pricingRules: JSON.stringify({
        basePrice: 0,
        rules: [{ type: "perUnit", input: "rooms", rate: 3, freeUnits: 0 }],
      }),
      durationRules: JSON.stringify({ baseMinutes: 0 }),
      inputFields: JSON.stringify([
        { key: "rooms", label: "Number of Rooms", type: "number", min: 1, max: 20, default: 1 },
      ]),
      isAddon: 0,
      parentServiceId: null,
      sortOrder: 3,
      visible: 0,
    },
  ];

  // Insert all services
  for (const svc of [...packageServices, ...addonServices]) {
    await db.insert(services).values(svc);
  }

  // Create whitelabel overrides (visible=1) so they show on whitelabel
  // And they're already visible=0 globally, so hidden on main
  const allIds = [...packageServices, ...addonServices].map((s) => s.id);
  for (const svcId of allIds) {
    await db.insert(serviceBrandOverrides).values({
      id: crypto.randomUUID(),
      serviceId: svcId,
      brandMode: "whitelabel",
      visible: 1,
      pricingRules: null, // use service default
      durationRules: null,
      inputFields: null,
    });
  }

  console.log(`Seeded ${packageServices.length} packages and ${addonServices.length} add-ons for whitelabel.`);
}

seed()
  .then(() => { console.log("Done."); process.exit(0); })
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); });
