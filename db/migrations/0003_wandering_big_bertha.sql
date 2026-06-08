ALTER TABLE "users" ADD COLUMN "plan" varchar(20) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_activated_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "razorpay_customer_id" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "razorpay_subscription_id" varchar(100);