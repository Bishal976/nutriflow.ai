DROP TABLE "clinician_reviews" CASCADE;--> statement-breakpoint
ALTER TABLE "daily_logs" DROP COLUMN "adherence_score";--> statement-breakpoint
ALTER TABLE "deviations" DROP COLUMN "user_acknowledged";--> statement-breakpoint
ALTER TABLE "medical_conditions" DROP COLUMN "clinician_confirmed";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "clinician_review_required";--> statement-breakpoint
DROP TYPE "public"."review_status";