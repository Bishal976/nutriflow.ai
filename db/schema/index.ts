import {
  pgTable, uuid, text, integer, real, boolean,
  timestamp, jsonb, pgEnum, varchar, index
} from 'drizzle-orm/pg-core'

export const riskLevelEnum = pgEnum('risk_level', ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'])
export const dietTypeEnum = pgEnum('diet_type', ['VEG', 'NON_VEG', 'VEGAN', 'JAIN', 'EGGETARIAN', 'PESCATARIAN'])
export const goalEnum = pgEnum('goal', ['WEIGHT_LOSS', 'WEIGHT_GAIN', 'MAINTENANCE', 'MUSCLE_GAIN', 'CONDITION_MANAGEMENT'])
export const mealTypeEnum = pgEnum('meal_type', ['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER'])
export const jobStatusEnum = pgEnum('job_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
export const activityLevelEnum = pgEnum('activity_level', ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  emailVerified: boolean('email_verified').default(false),
  emailVerificationToken: varchar('email_verification_token', { length: 128 }),
  emailVerificationExpiry: timestamp('email_verification_expiry'),
  onboardingComplete: boolean('onboarding_complete').default(false),
  isAdmin: boolean('is_admin').default(false),
  plan: varchar('plan', { length: 20 }).default('free').notNull(),
  planActivatedAt: timestamp('plan_activated_at'),
  planExpiresAt: timestamp('plan_expires_at'),
  razorpayCustomerId: varchar('razorpay_customer_id', { length: 100 }),
  razorpayPaymentId: varchar('razorpay_payment_id', { length: 100 }),
  passwordResetToken: varchar('password_reset_token', { length: 128 }),
  passwordResetExpiry: timestamp('password_reset_expiry'),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  dateOfBirth: timestamp('date_of_birth'),
  sex: varchar('sex', { length: 20 }),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  activityLevel: activityLevelEnum('activity_level'),
  primaryGoal: goalEnum('primary_goal'),
  secondaryGoals: text('secondary_goals').array().default([]),
  targetWeightKg: real('target_weight_kg'),
  dietType: dietTypeEnum('diet_type'),
  allergens: text('allergens').array(),
  cuisinePreferences: text('cuisine_preferences').array(),
  dislikedIngredients: text('disliked_ingredients').array(),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  timezone: varchar('timezone', { length: 100 }),
  lat: real('lat'),
  lon: real('lon'),
  riskLevel: riskLevelEnum('risk_level').default('LOW'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const medicalConditions = pgTable('medical_conditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  conditionCode: varchar('condition_code', { length: 100 }).notNull(),
  conditionLabel: varchar('condition_label', { length: 255 }).notNull(),
  severity: varchar('severity', { length: 50 }),
  onMedication: boolean('on_medication').default(false),
  medicationNotes: text('medication_notes'), // AES-256-GCM encrypted
  userConfirmed: boolean('user_confirmed').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('medical_conditions_user_idx').on(t.userId),
  index('medical_conditions_user_code_idx').on(t.userId, t.conditionCode),
])

export const medicalDocuments = pgTable('medical_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  storageKey: text('storage_key').notNull(),
  documentType: varchar('document_type', { length: 100 }),
  ocrRawText: text('ocr_raw_text'), // AES-256-GCM encrypted
  extractedData: jsonb('extracted_data'),
  confidenceScore: real('confidence_score'),
  lowConfidenceFields: text('low_confidence_fields').array(),
  userReviewed: boolean('user_reviewed').default(false),
  userCorrectedData: jsonb('user_corrected_data'),
  jobId: uuid('job_id'),
  jobStatus: jobStatusEnum('job_status').default('PENDING'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('medical_documents_user_idx').on(t.userId)])

export const nutritionTargets = pgTable('nutrition_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp('date').notNull(),
  targetCalories: integer('target_calories').notNull(),
  targetProteinG: real('target_protein_g').notNull(),
  targetCarbsG: real('target_carbs_g').notNull(),
  targetFatG: real('target_fat_g').notNull(),
  targetFiberG: real('target_fiber_g'),
  targetSodiumMg: real('target_sodium_mg'),
  targetPotassiumMg: real('target_potassium_mg'),
  targetPhosphorusMg: real('target_phosphorus_mg'),
  targetIronMg: real('target_iron_mg'),
  targetCalciumMg: real('target_calcium_mg'),
  targetWaterMl: integer('target_water_ml'),
  weatherContext: jsonb('weather_context'),
  tdeeKcal: integer('tdee_kcal'),
  bmrKcal: integer('bmr_kcal'),
  computedBy: varchar('computed_by', { length: 50 }).default('deterministic_engine'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('nutrition_targets_user_date_idx').on(t.userId, t.date)])

export const dailyLogs = pgTable('daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp('date').notNull(),
  nutritionTargetId: uuid('nutrition_target_id').references(() => nutritionTargets.id),
  actualCalories: integer('actual_calories').default(0),
  actualProteinG: real('actual_protein_g').default(0),
  actualCarbsG: real('actual_carbs_g').default(0),
  actualFatG: real('actual_fat_g').default(0),
  actualFiberG: real('actual_fiber_g').default(0),
  waterMl: integer('water_ml').default(0),
  planData: jsonb('plan_data'),
  planInputHash: text('plan_input_hash'),
  weatherContext: jsonb('weather_context'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('daily_logs_user_date_idx').on(t.userId, t.date),
  // unique constraint enables onConflictDoNothing in plan/generate
  { name: 'daily_logs_user_date_unique', columns: [t.userId, t.date], type: 'unique' as const },
])

export const mealLogs = pgTable('meal_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  dailyLogId: uuid('daily_log_id').references(() => dailyLogs.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mealType: mealTypeEnum('meal_type').notNull(),
  loggedAt: timestamp('logged_at').defaultNow().notNull(),
  sourceType: varchar('source_type', { length: 50 }),
  photoJobId: uuid('photo_job_id'),
  imageStorageKey: text('image_storage_key'),
  foodItems: jsonb('food_items').notNull(),
  userConfirmed: boolean('user_confirmed').default(false),
  userEdited: boolean('user_edited').default(false),
  estimatedCalories: integer('estimated_calories'),
  estimatedProteinG: real('estimated_protein_g'),
  estimatedCarbsG: real('estimated_carbs_g'),
  estimatedFatG: real('estimated_fat_g'),
  estimatedFiberG: real('estimated_fiber_g'),
  overallConfidence: real('overall_confidence'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const visionJobs = pgTable('vision_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  imageStorageKey: text('image_storage_key').notNull(),
  status: jobStatusEnum('status').default('PENDING'),
  result: jsonb('result'),
  errorMessage: text('error_message'),
  processingTimeMs: integer('processing_time_ms'),
  modelUsed: varchar('model_used', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

export const deviations = pgTable('deviations', {
  id: uuid('id').primaryKey().defaultRandom(),
  dailyLogId: uuid('daily_log_id').references(() => dailyLogs.id, { onDelete: 'cascade' }).notNull(),
  mealLogId: uuid('meal_log_id').references(() => mealLogs.id).notNull(),
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
  deltaCalories: integer('delta_calories').notNull(),
  deltaProteinG: real('delta_protein_g').notNull(),
  deltaCarbsG: real('delta_carbs_g').notNull(),
  deltaFatG: real('delta_fat_g').notNull(),
  rebalancedMeals: jsonb('rebalanced_meals'),
  rebalanceExplanation: text('rebalance_explanation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(), // no FK — logs outlive user deletes
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: uuid('resource_id'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('audit_logs_user_idx').on(t.userId)])
