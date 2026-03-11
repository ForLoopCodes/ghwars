ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sync_count_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "incremental_syncs" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "full_syncs" integer DEFAULT 0 NOT NULL;