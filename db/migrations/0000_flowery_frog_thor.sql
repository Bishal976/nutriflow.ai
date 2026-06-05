CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active');--> statement-breakpoint
CREATE TYPE "public"."diet_type" AS ENUM('VEG', 'NON_VEG', 'VEGAN', 'JAIN', 'EGGETARIAN', 'PESCATARIAN');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('WEIGHT_LOSS', 'WEIGHT_GAIN', 'MAINTENANCE', 'MUSCLE_GAIN', 'CONDITION_MANAGEMENT');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'ESCALATED');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MODERATE', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100),
	"resource_id" uuid,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinician_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"review_status" "review_status" DEFAULT 'PENDING',
	"trigger_reason" text NOT NULL,
	"trigger_condition_codes" text[],
	"reviewer_admin_id" uuid,
	"reviewer_notes" text,
	"approved_plan_overrides" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"nutrition_target_id" uuid,
	"actual_calories" integer DEFAULT 0,
	"actual_protein_g" real DEFAULT 0,
	"actual_carbs_g" real DEFAULT 0,
	"actual_fat_g" real DEFAULT 0,
	"actual_fiber_g" real DEFAULT 0,
	"water_ml" integer DEFAULT 0,
	"adherence_score" real,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deviations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"meal_log_id" uuid NOT NULL,
	"triggered_at" timestamp DEFAULT now() NOT NULL,
	"delta_calories" integer NOT NULL,
	"delta_protein_g" real NOT NULL,
	"delta_carbs_g" real NOT NULL,
	"delta_fat_g" real NOT NULL,
	"rebalanced_meals" jsonb,
	"rebalance_explanation" text,
	"user_acknowledged" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL,
	"source_type" varchar(50),
	"photo_job_id" uuid,
	"image_storage_key" text,
	"food_items" jsonb NOT NULL,
	"user_confirmed" boolean DEFAULT false,
	"user_edited" boolean DEFAULT false,
	"estimated_calories" integer,
	"estimated_protein_g" real,
	"estimated_carbs_g" real,
	"estimated_fat_g" real,
	"estimated_fiber_g" real,
	"overall_confidence" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"condition_code" varchar(100) NOT NULL,
	"condition_label" varchar(255) NOT NULL,
	"severity" varchar(50),
	"on_medication" boolean DEFAULT false,
	"medication_notes" text,
	"user_confirmed" boolean DEFAULT false,
	"clinician_confirmed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"document_type" varchar(100),
	"ocr_raw_text" text,
	"extracted_data" jsonb,
	"confidence_score" real,
	"low_confidence_fields" text[],
	"user_reviewed" boolean DEFAULT false,
	"user_corrected_data" jsonb,
	"job_id" uuid,
	"job_status" "job_status" DEFAULT 'PENDING',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" timestamp NOT NULL,
	"target_calories" integer NOT NULL,
	"target_protein_g" real NOT NULL,
	"target_carbs_g" real NOT NULL,
	"target_fat_g" real NOT NULL,
	"target_fiber_g" real,
	"target_sodium_mg" real,
	"target_potassium_mg" real,
	"target_phosphorus_mg" real,
	"target_iron_mg" real,
	"target_calcium_mg" real,
	"target_water_ml" integer,
	"weather_context" jsonb,
	"tdee_kcal" integer,
	"bmr_kcal" integer,
	"computed_by" varchar(50) DEFAULT 'deterministic_engine',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"date_of_birth" timestamp,
	"sex" varchar(20),
	"height_cm" real,
	"weight_kg" real,
	"activity_level" "activity_level",
	"primary_goal" "goal",
	"target_weight_kg" real,
	"diet_type" "diet_type",
	"allergens" text[],
	"cuisine_preferences" text[],
	"disliked_ingredients" text[],
	"city" varchar(100),
	"country" varchar(100),
	"timezone" varchar(100),
	"lat" real,
	"lon" real,
	"risk_level" "risk_level" DEFAULT 'LOW',
	"clinician_review_required" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"email_verified" boolean DEFAULT false,
	"onboarding_complete" boolean DEFAULT false,
	"is_admin" boolean DEFAULT false,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vision_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_storage_key" text NOT NULL,
	"status" "job_status" DEFAULT 'PENDING',
	"result" jsonb,
	"error_message" text,
	"processing_time_ms" integer,
	"model_used" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "clinician_reviews" ADD CONSTRAINT "clinician_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_nutrition_target_id_nutrition_targets_id_fk" FOREIGN KEY ("nutrition_target_id") REFERENCES "public"."nutrition_targets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_meal_log_id_meal_logs_id_fk" FOREIGN KEY ("meal_log_id") REFERENCES "public"."meal_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_conditions" ADD CONSTRAINT "medical_conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vision_jobs" ADD CONSTRAINT "vision_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_logs_user_date_idx" ON "daily_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "medical_conditions_user_idx" ON "medical_conditions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "medical_documents_user_idx" ON "medical_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nutrition_targets_user_date_idx" ON "nutrition_targets" USING btree ("user_id","date");