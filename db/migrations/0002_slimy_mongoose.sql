ALTER TABLE "users" ADD COLUMN "email_verification_token" varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verification_expiry" timestamp;