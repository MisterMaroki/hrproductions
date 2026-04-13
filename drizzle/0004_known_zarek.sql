CREATE TABLE `bookings_whitelabel` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`postcode` text,
	`bedrooms` integer NOT NULL,
	`preferred_date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`notes` text,
	`agent_name` text NOT NULL,
	`agent_company` text,
	`agent_email` text NOT NULL,
	`agent_phone` text,
	`services` text NOT NULL,
	`work_hours` real NOT NULL,
	`subtotal` integer NOT NULL,
	`discount_code` text,
	`discount_amount` integer DEFAULT 0,
	`total` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`whitelabel_invoice_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `whitelabel_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`total_amount` integer NOT NULL,
	`booking_count` integer NOT NULL,
	`generated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whitelabel_invoices_invoice_number_unique` ON `whitelabel_invoices` (`invoice_number`);
