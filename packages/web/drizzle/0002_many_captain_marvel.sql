DROP INDEX "apikey_company_idx";--> statement-breakpoint
DROP INDEX "attach_company_idx";--> statement-breakpoint
DROP INDEX "audit_entity_idx";--> statement-breakpoint
DROP INDEX "audit_actor_idx";--> statement-breakpoint
DROP INDEX "audit_created_idx";--> statement-breakpoint
DROP INDEX "audit_company_idx";--> statement-breakpoint
DROP INDEX "autorule_company_idx";--> statement-breakpoint
DROP INDEX "bk_company_idx";--> statement-breakpoint
DROP INDEX "bk_status_idx";--> statement-breakpoint
DROP INDEX "bk_sched_idx";--> statement-breakpoint
DROP INDEX "bk_finished_idx";--> statement-breakpoint
DROP INDEX "bk_rider_idx";--> statement-breakpoint
DROP INDEX "bk_customer_idx";--> statement-breakpoint
DROP INDEX "bk_service_idx";--> statement-breakpoint
DROP INDEX "bk_paystatus_idx";--> statement-breakpoint
DROP INDEX "bk_priority_idx";--> statement-breakpoint
DROP INDEX "bk_region_idx";--> statement-breakpoint
DROP INDEX "bk_deleted_idx";--> statement-breakpoint
DROP INDEX "bk_created_idx";--> statement-breakpoint
DROP INDEX "catalog_company_idx";--> statement-breakpoint
DROP INDEX "settings_company_idx";--> statement-breakpoint
DROP INDEX "cfv_company_idx";--> statement-breakpoint
DROP INDEX "cf_company_idx";--> statement-breakpoint
DROP INDEX "emailtpl_company_idx";--> statement-breakpoint
DROP INDEX "etags_company_idx";--> statement-breakpoint
DROP INDEX "intake_company_idx";--> statement-breakpoint
DROP INDEX "intake_slug_idx";--> statement-breakpoint
DROP INDEX "intakesub_company_idx";--> statement-breakpoint
DROP INDEX "intakesub_form_idx";--> statement-breakpoint
DROP INDEX "integ_company_idx";--> statement-breakpoint
DROP INDEX "inv_company_idx";--> statement-breakpoint
DROP INDEX "inv_booking_idx";--> statement-breakpoint
DROP INDEX "inv_pi_idx";--> statement-breakpoint
DROP INDEX "jobphoto_company_idx";--> statement-breakpoint
DROP INDEX "msg_company_idx";--> statement-breakpoint
DROP INDEX "notifchan_company_idx";--> statement-breakpoint
DROP INDEX "notifdeliv_company_idx";--> statement-breakpoint
DROP INDEX "notifrule_company_idx";--> statement-breakpoint
DROP INDEX "notif_company_idx";--> statement-breakpoint
DROP INDEX "ledger_company_idx";--> statement-breakpoint
DROP INDEX "ledger_invoice_idx";--> statement-breakpoint
DROP INDEX "ledger_booking_idx";--> statement-breakpoint
DROP INDEX "payout_company_idx";--> statement-breakpoint
DROP INDEX "push_tokens_token_unique";--> statement-breakpoint
DROP INDEX "push_tokens_user_idx";--> statement-breakpoint
DROP INDEX "review_company_idx";--> statement-breakpoint
DROP INDEX "riders_company_idx";--> statement-breakpoint
DROP INDEX "zone_company_idx";--> statement-breakpoint
DROP INDEX "services_company_idx";--> statement-breakpoint
DROP INDEX "skill_company_idx";--> statement-breakpoint
DROP INDEX "tags_company_idx";--> statement-breakpoint
DROP INDEX "tasktpl_company_idx";--> statement-breakpoint
DROP INDEX "techinvite_company_idx";--> statement-breakpoint
DROP INDEX "shift_company_idx";--> statement-breakpoint
DROP INDEX "ted_company_idx";--> statement-breakpoint
DROP INDEX "tp_booking_created_idx";--> statement-breakpoint
DROP INDEX "tp_created_idx";--> statement-breakpoint
DROP INDEX "tp_company_idx";--> statement-breakpoint
DROP INDEX "webhook_company_idx";--> statement-breakpoint
DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE `tenant_email_domains` ALTER COLUMN "region" TO "region" text NOT NULL DEFAULT 'eu-west-1';--> statement-breakpoint
CREATE INDEX `apikey_company_idx` ON `api_keys` (`company_id`);--> statement-breakpoint
CREATE INDEX `attach_company_idx` ON `attachments` (`company_id`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_company_idx` ON `audit_log` (`company_id`);--> statement-breakpoint
CREATE INDEX `autorule_company_idx` ON `automation_rules` (`company_id`);--> statement-breakpoint
CREATE INDEX `bk_company_idx` ON `bookings` (`company_id`);--> statement-breakpoint
CREATE INDEX `bk_status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `bk_sched_idx` ON `bookings` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `bk_finished_idx` ON `bookings` (`finished_at`);--> statement-breakpoint
CREATE INDEX `bk_rider_idx` ON `bookings` (`rider_id`);--> statement-breakpoint
CREATE INDEX `bk_customer_idx` ON `bookings` (`customer_id`);--> statement-breakpoint
CREATE INDEX `bk_service_idx` ON `bookings` (`service_id`);--> statement-breakpoint
CREATE INDEX `bk_paystatus_idx` ON `bookings` (`payment_status`);--> statement-breakpoint
CREATE INDEX `bk_priority_idx` ON `bookings` (`priority`);--> statement-breakpoint
CREATE INDEX `bk_region_idx` ON `bookings` (`region`);--> statement-breakpoint
CREATE INDEX `bk_deleted_idx` ON `bookings` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `bk_created_idx` ON `bookings` (`created_at`);--> statement-breakpoint
CREATE INDEX `catalog_company_idx` ON `catalog_items` (`company_id`);--> statement-breakpoint
CREATE INDEX `settings_company_idx` ON `company_settings` (`company_id`);--> statement-breakpoint
CREATE INDEX `cfv_company_idx` ON `custom_field_values` (`company_id`);--> statement-breakpoint
CREATE INDEX `cf_company_idx` ON `custom_fields` (`company_id`);--> statement-breakpoint
CREATE INDEX `emailtpl_company_idx` ON `email_templates` (`company_id`);--> statement-breakpoint
CREATE INDEX `etags_company_idx` ON `entity_tags` (`company_id`);--> statement-breakpoint
CREATE INDEX `intake_company_idx` ON `intake_forms` (`company_id`);--> statement-breakpoint
CREATE INDEX `intake_slug_idx` ON `intake_forms` (`company_id`,`slug`);--> statement-breakpoint
CREATE INDEX `intakesub_company_idx` ON `intake_submissions` (`company_id`);--> statement-breakpoint
CREATE INDEX `intakesub_form_idx` ON `intake_submissions` (`form_id`);--> statement-breakpoint
CREATE INDEX `integ_company_idx` ON `integrations` (`company_id`);--> statement-breakpoint
CREATE INDEX `inv_company_idx` ON `invoices` (`company_id`);--> statement-breakpoint
CREATE INDEX `inv_booking_idx` ON `invoices` (`booking_id`);--> statement-breakpoint
CREATE INDEX `inv_pi_idx` ON `invoices` (`stripe_payment_intent_id`);--> statement-breakpoint
CREATE INDEX `jobphoto_company_idx` ON `job_photos` (`company_id`);--> statement-breakpoint
CREATE INDEX `msg_company_idx` ON `messages` (`company_id`);--> statement-breakpoint
CREATE INDEX `notifchan_company_idx` ON `notification_channels` (`company_id`);--> statement-breakpoint
CREATE INDEX `notifdeliv_company_idx` ON `notification_deliveries` (`company_id`);--> statement-breakpoint
CREATE INDEX `notifrule_company_idx` ON `notification_rules` (`company_id`);--> statement-breakpoint
CREATE INDEX `notif_company_idx` ON `notifications` (`company_id`);--> statement-breakpoint
CREATE INDEX `ledger_company_idx` ON `payment_ledger` (`company_id`);--> statement-breakpoint
CREATE INDEX `ledger_invoice_idx` ON `payment_ledger` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `ledger_booking_idx` ON `payment_ledger` (`booking_id`);--> statement-breakpoint
CREATE INDEX `payout_company_idx` ON `payouts` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_tokens_token_unique` ON `push_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `push_tokens_user_idx` ON `push_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `review_company_idx` ON `reviews` (`company_id`);--> statement-breakpoint
CREATE INDEX `riders_company_idx` ON `riders` (`company_id`);--> statement-breakpoint
CREATE INDEX `zone_company_idx` ON `service_zones` (`company_id`);--> statement-breakpoint
CREATE INDEX `services_company_idx` ON `services` (`company_id`);--> statement-breakpoint
CREATE INDEX `skill_company_idx` ON `skill_library` (`company_id`);--> statement-breakpoint
CREATE INDEX `tags_company_idx` ON `tags` (`company_id`);--> statement-breakpoint
CREATE INDEX `tasktpl_company_idx` ON `task_templates` (`company_id`);--> statement-breakpoint
CREATE INDEX `techinvite_company_idx` ON `tech_invites` (`company_id`);--> statement-breakpoint
CREATE INDEX `shift_company_idx` ON `tech_shifts` (`company_id`);--> statement-breakpoint
CREATE INDEX `ted_company_idx` ON `tenant_email_domains` (`company_id`);--> statement-breakpoint
CREATE INDEX `tp_booking_created_idx` ON `tracking_pings` (`booking_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `tp_created_idx` ON `tracking_pings` (`created_at`);--> statement-breakpoint
CREATE INDEX `tp_company_idx` ON `tracking_pings` (`company_id`);--> statement-breakpoint
CREATE INDEX `webhook_company_idx` ON `webhook_endpoints` (`company_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `intake_forms` ADD `sections` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `intake_forms` ADD `recipient_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `intake_forms` ADD `recipient_email` text DEFAULT '' NOT NULL;