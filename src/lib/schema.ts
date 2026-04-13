import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  postcode: text("postcode"),
  bedrooms: integer("bedrooms").notNull(),
  preferredDate: text("preferred_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
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
  clientId: text("client_id"),
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

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("pending_approval"),
  gocardlessMandateId: text("gocardless_mandate_id"),
  gocardlessCustomerId: text("gocardless_customer_id"),
  bookingsPaused: integer("bookings_paused").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").notNull().default("pending"),
  gocardlessPaymentId: text("gocardless_payment_id"),
  pdfPath: text("pdf_path"),
  failureReason: text("failure_reason"),
  chargedAt: text("charged_at"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  bookingId: text("booking_id").notNull(),
  amount: integer("amount").notNull(),
});

export const serviceCategories = sqliteTable("service_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  pricingRules: text("pricing_rules").notNull(),
  durationRules: text("duration_rules").notNull(),
  inputFields: text("input_fields").notNull(),
  isAddon: integer("is_addon").notNull().default(0),
  parentServiceId: text("parent_service_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: integer("visible").notNull().default(1),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const serviceBrandOverrides = sqliteTable("service_brand_overrides", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  brandMode: text("brand_mode").notNull(),
  visible: integer("visible").notNull().default(1),
  pricingRules: text("pricing_rules"),
  durationRules: text("duration_rules"),
  inputFields: text("input_fields"),
});

export const bookingsWhitelabel = sqliteTable("bookings_whitelabel", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  postcode: text("postcode"),
  bedrooms: integer("bedrooms").notNull(),
  preferredDate: text("preferred_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
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
  status: text("status").notNull().default("confirmed"),
  whitelabelInvoiceId: text("whitelabel_invoice_id"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const whitelabelInvoices = sqliteTable("whitelabel_invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  totalAmount: integer("total_amount").notNull(),
  bookingCount: integer("booking_count").notNull(),
  generatedAt: text("generated_at").default(sql`CURRENT_TIMESTAMP`),
});
