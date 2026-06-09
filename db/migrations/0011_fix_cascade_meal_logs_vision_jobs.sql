ALTER TABLE "meal_logs" DROP CONSTRAINT "meal_logs_user_id_users_id_fk";
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "vision_jobs" DROP CONSTRAINT "vision_jobs_user_id_users_id_fk";
ALTER TABLE "vision_jobs" ADD CONSTRAINT "vision_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "deviations" DROP CONSTRAINT "deviations_meal_log_id_meal_logs_id_fk";
ALTER TABLE "deviations" ADD CONSTRAINT "deviations_meal_log_id_meal_logs_id_fk" FOREIGN KEY ("meal_log_id") REFERENCES "meal_logs"("id") ON DELETE CASCADE;
