ALTER TABLE "academic_periods"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();
