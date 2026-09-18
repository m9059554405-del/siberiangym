ALTER TABLE "trainer_credentials" ADD COLUMN "expires_at" DATE;
ALTER TABLE "trainer_credentials" ADD COLUMN "is_required" BOOLEAN NOT NULL DEFAULT false;
