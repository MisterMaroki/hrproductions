CREATE TABLE `service_brand_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text NOT NULL,
	`brand_mode` text NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	`pricing_rules` text,
	`duration_rules` text,
	`input_fields` text
);
--> statement-breakpoint
CREATE TABLE `service_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`pricing_rules` text NOT NULL,
	`duration_rules` text NOT NULL,
	`input_fields` text NOT NULL,
	`is_addon` integer DEFAULT 0 NOT NULL,
	`parent_service_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
