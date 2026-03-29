import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { seedServices } from "../src/lib/seed-services";

seedServices()
  .then(() => { console.log("Done."); process.exit(0); })
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); });
