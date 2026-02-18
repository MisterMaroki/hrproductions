import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  postcode: text("postcode"),
  bedrooms: integer("bedrooms").notNull(),
  preferredDate: text("preferred_date").notNull(),
  notes: text("notes"),
  agentName: text("agent_name").notNull(),
  agentCompany: text("agent_company"),
  agentEmail: text("agent_email").notNull(),
  agentPhone: text("agent_phone"),
  services: text("services").notNull(),
  workHours: real("work_hours").notNull(),
  subtotal: integer("subtotal").notNull(),
  discountCode: text("discount_code"),
  discountAmount: integer("discount_amount").default(0),
  total: integer("total").notNull(),
  stripeSession: text("stripe_session"),
  status: text("status").default("confirmed"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const discountCodes = sqliteTable("discount_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  percentage: integer("percentage").notNull(),
  active: integer("active").default(1),
  maxUses: integer("max_uses"),
  timesUsed: integer("times_used").default(0),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const blockedDays = sqliteTable("blocked_days", {
  id: text("id").primaryKey(),
  date: text("date").notNull().unique(),
  reason: text("reason"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const galleryVideos = sqliteTable("gallery_videos", {
  id: text("id").primaryKey(),
  bunnyVideoId: text("bunny_video_id").notNull().unique(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: integer("visible").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const galleryPhotos = sqliteTable("gallery_photos", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull().unique(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: integer("visible").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
