-- Replace the plain index on medical_conditions(user_id, condition_code) with
-- a unique constraint: at most one row per condition per user, enforced by
-- the DB, not just app discipline.
DROP INDEX IF EXISTS "medical_conditions_user_code_idx";
ALTER TABLE "medical_conditions" ADD CONSTRAINT "medical_conditions_user_code_unique" UNIQUE ("user_id", "condition_code");

-- New table: tracks which document(s) support which condition code, so
-- deleting one document among several can precisely determine whether a
-- condition is still backed by another remaining document.
CREATE TABLE "document_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"condition_code" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "document_conditions" ADD CONSTRAINT "document_conditions_document_id_medical_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "medical_documents"("id") ON DELETE CASCADE;
ALTER TABLE "document_conditions" ADD CONSTRAINT "document_conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
CREATE INDEX "document_conditions_document_idx" ON "document_conditions" ("document_id");
CREATE INDEX "document_conditions_user_code_idx" ON "document_conditions" ("user_id", "condition_code");
ALTER TABLE "document_conditions" ADD CONSTRAINT "document_conditions_document_code_unique" UNIQUE ("document_id", "condition_code");
