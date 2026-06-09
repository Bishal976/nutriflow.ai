ALTER TABLE "users" ADD COLUMN "password_reset_token" varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_expiry" timestamp;