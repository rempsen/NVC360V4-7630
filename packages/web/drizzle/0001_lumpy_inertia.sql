CREATE TABLE `intake_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text DEFAULT 'default' NOT NULL,
	`slug` text NOT NULL,
	`title` text DEFAULT 'Request Service' NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`fields` text DEFAULT '[]' NOT NULL,
	`public_key_id` text DEFAULT '' NOT NULL,
	`brand_color` text DEFAULT '#06b6d4' NOT NULL,
	`logo_url` text DEFAULT '' NOT NULL,
	`success_message` text DEFAULT 'Thanks! We''ve received your request and will reach out shortly.' NOT NULL,
	`default_service_id` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`submit_count` integer DEFAULT 0 NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`updated_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `intake_company_idx` ON `intake_forms` (`company_id`);--> statement-breakpoint
CREATE INDEX `intake_slug_idx` ON `intake_forms` (`company_id`,`slug`);--> statement-breakpoint
CREATE TABLE `intake_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text DEFAULT 'default' NOT NULL,
	`form_id` text DEFAULT '' NOT NULL,
	`booking_id` text DEFAULT '' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`ip_hash` text DEFAULT '' NOT NULL,
	`origin` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `intakesub_company_idx` ON `intake_submissions` (`company_id`);--> statement-breakpoint
CREATE INDEX `intakesub_form_idx` ON `intake_submissions` (`form_id`);--> statement-breakpoint
CREATE TABLE `oauth_app_credentials` (
	`provider` text PRIMARY KEY NOT NULL,
	`client_id` text DEFAULT '' NOT NULL,
	`client_secret` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text DEFAULT 'default' NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text DEFAULT 'ios' NOT NULL,
	`device_name` text DEFAULT '' NOT NULL,
	`last_seen_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_tokens_token_unique` ON `push_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `push_tokens_user_idx` ON `push_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `tenant_email_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text DEFAULT 'default' NOT NULL,
	`domain` text NOT NULL,
	`resend_domain_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`region` text DEFAULT 'us-east-1' NOT NULL,
	`records` text DEFAULT '[]' NOT NULL,
	`last_checked_at` integer,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ted_company_idx` ON `tenant_email_domains` (`company_id`);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `key_type` text DEFAULT 'secret' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `public_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `allowed_origins` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `industry` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `logo_source_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `accent_color` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `worker_noun` text DEFAULT 'Technician' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `worker_noun_plural` text DEFAULT 'Technicians' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `tagline` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `hours` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `services` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `socials` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `riders` ADD `photo_key` text DEFAULT '' NOT NULL;