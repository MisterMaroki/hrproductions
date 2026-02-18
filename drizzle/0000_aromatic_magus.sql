CREATE TABLE `blocked_days` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_days_date_unique` ON `blocked_days` (`date`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`postcode` text,
	`bedrooms` integer NOT NULL,
	`preferred_date` text NOT NULL,
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
	`stripe_session` text,
	`status` text DEFAULT 'confirmed',
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`percentage` integer NOT NULL,
	`active` integer DEFAULT 1,
	`max_uses` integer,
	`times_used` integer DEFAULT 0,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_codes_code_unique` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE TABLE `gallery_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_photos_filename_unique` ON `gallery_photos` (`filename`);--> statement-breakpoint
CREATE TABLE `gallery_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`bunny_video_id` text NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gallery_videos_bunny_video_id_unique` ON `gallery_videos` (`bunny_video_id`);