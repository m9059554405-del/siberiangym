-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'TRAINER', 'CEO', 'STAFF');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "ClientFormat" AS ENUM ('PERSONAL', 'GROUP', 'SELF');

-- CreateEnum
CREATE TYPE "Tariff" AS ENUM ('BASIC', 'COACHING', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('SINGLE', 'MONTHLY', 'PACK10', 'PACK20');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'FROZEN');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'ABS');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('COMPLETED', 'PARTIAL', 'MISSED');

-- CreateEnum
CREATE TYPE "EffortLevel" AS ENUM ('WARMUP', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('FREE', 'BOOKED', 'PAST_COMPLETED', 'PAST_MISSED');

-- CreateEnum
CREATE TYPE "LockerStatus" AS ENUM ('FREE', 'RENTED');

-- CreateEnum
CREATE TYPE "CatalogCategory" AS ENUM ('FOOD', 'WATER');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('MEMBERSHIP', 'PERSONAL', 'GROUP', 'ANCILLARY');

-- CreateEnum
CREATE TYPE "ClubPostType" AS ENUM ('NEWS', 'PHOTO', 'VIDEO', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "ProgressPhotoKind" AS ENUM ('FOOD', 'BODY');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'OTHER');

-- CreateEnum
CREATE TYPE "StockLocation" AS ENUM ('SHELF', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "WriteoffReason" AS ENUM ('EXPIRED', 'DAMAGED', 'SOLD_MANUAL', 'USED_INTERNALLY', 'LOST', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('LIGHTING', 'RESTROOMS', 'LOCKERS', 'AC', 'FRIDGES', 'GYM_EQUIPMENT');

-- CreateEnum
CREATE TYPE "CleaningArea" AS ENUM ('FLOOR', 'LIGHTING', 'SURFACES', 'MIRRORS', 'RESTROOMS', 'LOCKERS', 'WINDOWS');

-- CreateEnum
CREATE TYPE "OfferAudience" AS ENUM ('ALL', 'EXPIRING_SOON', 'TOP_PERFORMERS');

-- CreateTable
CREATE TABLE "gyms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "avatar_hue" INTEGER NOT NULL DEFAULT 210,
    "trainer_id" TEXT,
    "format" "ClientFormat" NOT NULL DEFAULT 'SELF',
    "tariff" "Tariff",
    "joined_at" TIMESTAMP(3) NOT NULL,
    "birthday" DATE,
    "phone" TEXT,
    "email" TEXT,
    "profile_photo_url" TEXT,
    "split_plan" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "type" "MembershipType" NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL,
    "expires_at" DATE,
    "visits_total" INTEGER,
    "visits_left" INTEGER,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_format_history" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "trainer_id" TEXT,
    "format" "ClientFormat" NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE,
    "reason" TEXT,

    CONSTRAINT "client_format_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "avatar_hue" INTEGER NOT NULL DEFAULT 210,
    "specialization" TEXT NOT NULL,
    "bio" TEXT,
    "full_bio" TEXT,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "personal_session_price" INTEGER NOT NULL,
    "external_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_work_hours" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "start_hour" INTEGER NOT NULL,
    "end_hour" INTEGER NOT NULL,

    CONSTRAINT "trainer_work_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_credentials" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issued_by" TEXT,
    "year" INTEGER,

    CONSTRAINT "trainer_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_competition_photos" (
    "id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,

    CONSTRAINT "trainer_competition_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscle_group" "MuscleGroup" NOT NULL,
    "default_sets" INTEGER NOT NULL,
    "default_reps" TEXT NOT NULL,
    "default_load" TEXT NOT NULL,
    "technique" TEXT,
    "equipment" TEXT,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_days" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "program_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_exercise_entries" (
    "id" TEXT NOT NULL,
    "program_day_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "load" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "program_exercise_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_log_entries" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day_label" TEXT NOT NULL,
    "status" "WorkoutStatus" NOT NULL,

    CONSTRAINT "workout_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercise_logs" (
    "id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,

    CONSTRAINT "workout_exercise_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_set_logs" (
    "id" TEXT NOT NULL,
    "exercise_log_id" TEXT NOT NULL,
    "reps" TEXT NOT NULL,
    "load" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "effort" "EffortLevel",
    "rest_seconds" INTEGER,

    CONSTRAINT "workout_set_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_classes" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,

    CONSTRAINT "group_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_class_bookings" (
    "id" TEXT NOT NULL,
    "group_class_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_class_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_slots" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "trainer_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "client_id" TEXT,
    "status" "SlotStatus" NOT NULL DEFAULT 'FREE',

    CONSTRAINT "personal_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lockers" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "LockerStatus" NOT NULL DEFAULT 'FREE',
    "rented_by" TEXT,
    "rented_until" DATE,
    "price_per_day" INTEGER NOT NULL,

    CONSTRAINT "lockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CatalogCategory" NOT NULL,
    "price" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "client_id" TEXT NOT NULL,
    "trainer_id" TEXT,
    "description" TEXT NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_pricing" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "single" INTEGER NOT NULL,
    "monthly" INTEGER NOT NULL,
    "pack10" INTEGER NOT NULL,
    "pack20" INTEGER NOT NULL,
    "personal_single" INTEGER NOT NULL,
    "personal_pack5" INTEGER NOT NULL,
    "group_single" INTEGER NOT NULL,
    "group_monthly" INTEGER NOT NULL,

    CONSTRAINT "membership_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_posts" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_name" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "type" "ClubPostType" NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "club_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "club_post_media" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,

    CONSTRAINT "club_post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_messages" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,

    CONSTRAINT "feedback_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_photos" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "ProgressPhotoKind" NOT NULL,
    "meal_type" "MealType",
    "url" TEXT NOT NULL,
    "caption" TEXT,

    CONSTRAINT "progress_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight_kg" DOUBLE PRECISION,
    "body_fat_percent" DOUBLE PRECISION,
    "muscle_mass_kg" DOUBLE PRECISION,
    "water_percent" DOUBLE PRECISION,
    "visceral_fat" DOUBLE PRECISION,
    "chest_cm" DOUBLE PRECISION,
    "waist_cm" DOUBLE PRECISION,
    "hips_cm" DOUBLE PRECISION,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_logs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "cycle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "location" "StockLocation" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "received_at" DATE NOT NULL,
    "expires_at" DATE NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_writeoffs" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "location" "StockLocation" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "WriteoffReason" NOT NULL,
    "comment" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" TEXT NOT NULL,

    CONSTRAINT "stock_writeoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipts" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "location" "StockLocation" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" TEXT NOT NULL,

    CONSTRAINT "stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" TEXT NOT NULL,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_entries" (
    "id" TEXT NOT NULL,
    "inventory_count_id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "location" "StockLocation" NOT NULL,
    "system_qty" INTEGER NOT NULL,
    "counted_qty" INTEGER NOT NULL,

    CONSTRAINT "inventory_count_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "zone" TEXT NOT NULL,
    "responsible_name" TEXT NOT NULL,
    "last_service_date" DATE NOT NULL,
    "next_service_date" DATE NOT NULL,
    "interval_days" INTEGER NOT NULL,
    "warranty_until" DATE,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_checklists" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "responsible_name" TEXT NOT NULL,

    CONSTRAINT "cleaning_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "area" "CleaningArea" NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cleaning_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "director_messages" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "reply_seen_by_client" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "director_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_offers" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audience" "OfferAudience" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log_entries" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT NOT NULL,
    "actor_role" "Role" NOT NULL,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" TEXT NOT NULL,

    CONSTRAINT "activity_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_notes" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "called" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,

    CONSTRAINT "outreach_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_gym_id_idx" ON "users"("gym_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_user_id_key" ON "clients"("user_id");

-- CreateIndex
CREATE INDEX "clients_gym_id_idx" ON "clients"("gym_id");

-- CreateIndex
CREATE INDEX "clients_trainer_id_idx" ON "clients"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_client_id_key" ON "memberships"("client_id");

-- CreateIndex
CREATE INDEX "client_format_history_client_id_idx" ON "client_format_history"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "trainers_user_id_key" ON "trainers"("user_id");

-- CreateIndex
CREATE INDEX "trainers_gym_id_idx" ON "trainers"("gym_id");

-- CreateIndex
CREATE INDEX "exercises_gym_id_idx" ON "exercises"("gym_id");

-- CreateIndex
CREATE INDEX "programs_client_id_idx" ON "programs"("client_id");

-- CreateIndex
CREATE INDEX "workout_log_entries_client_id_idx" ON "workout_log_entries"("client_id");

-- CreateIndex
CREATE INDEX "group_classes_gym_id_idx" ON "group_classes"("gym_id");

-- CreateIndex
CREATE INDEX "group_classes_trainer_id_idx" ON "group_classes"("trainer_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_class_bookings_group_class_id_client_id_key" ON "group_class_bookings"("group_class_id", "client_id");

-- CreateIndex
CREATE INDEX "personal_slots_gym_id_idx" ON "personal_slots"("gym_id");

-- CreateIndex
CREATE INDEX "personal_slots_trainer_id_idx" ON "personal_slots"("trainer_id");

-- CreateIndex
CREATE INDEX "lockers_gym_id_idx" ON "lockers"("gym_id");

-- CreateIndex
CREATE INDEX "catalog_items_gym_id_idx" ON "catalog_items"("gym_id");

-- CreateIndex
CREATE INDEX "transactions_gym_id_idx" ON "transactions"("gym_id");

-- CreateIndex
CREATE INDEX "transactions_client_id_idx" ON "transactions"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_pricing_gym_id_key" ON "membership_pricing"("gym_id");

-- CreateIndex
CREATE INDEX "club_posts_gym_id_idx" ON "club_posts"("gym_id");

-- CreateIndex
CREATE INDEX "feedback_messages_client_id_idx" ON "feedback_messages"("client_id");

-- CreateIndex
CREATE INDEX "progress_photos_client_id_idx" ON "progress_photos"("client_id");

-- CreateIndex
CREATE INDEX "measurements_client_id_idx" ON "measurements"("client_id");

-- CreateIndex
CREATE INDEX "cycle_logs_client_id_idx" ON "cycle_logs"("client_id");

-- CreateIndex
CREATE INDEX "stock_batches_gym_id_idx" ON "stock_batches"("gym_id");

-- CreateIndex
CREATE INDEX "stock_batches_catalog_item_id_idx" ON "stock_batches"("catalog_item_id");

-- CreateIndex
CREATE INDEX "stock_writeoffs_gym_id_idx" ON "stock_writeoffs"("gym_id");

-- CreateIndex
CREATE INDEX "stock_receipts_gym_id_idx" ON "stock_receipts"("gym_id");

-- CreateIndex
CREATE INDEX "inventory_counts_gym_id_idx" ON "inventory_counts"("gym_id");

-- CreateIndex
CREATE INDEX "equipment_gym_id_idx" ON "equipment"("gym_id");

-- CreateIndex
CREATE INDEX "cleaning_checklists_gym_id_idx" ON "cleaning_checklists"("gym_id");

-- CreateIndex
CREATE UNIQUE INDEX "cleaning_checklist_items_checklist_id_area_key" ON "cleaning_checklist_items"("checklist_id", "area");

-- CreateIndex
CREATE INDEX "director_messages_gym_id_idx" ON "director_messages"("gym_id");

-- CreateIndex
CREATE INDEX "report_offers_gym_id_idx" ON "report_offers"("gym_id");

-- CreateIndex
CREATE INDEX "activity_log_entries_gym_id_idx" ON "activity_log_entries"("gym_id");

-- CreateIndex
CREATE INDEX "activity_log_entries_date_idx" ON "activity_log_entries"("date");

-- CreateIndex
CREATE INDEX "outreach_notes_gym_id_idx" ON "outreach_notes"("gym_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_format_history" ADD CONSTRAINT "client_format_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_work_hours" ADD CONSTRAINT "trainer_work_hours_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_credentials" ADD CONSTRAINT "trainer_credentials_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_competition_photos" ADD CONSTRAINT "trainer_competition_photos_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_exercise_entries" ADD CONSTRAINT "program_exercise_entries_program_day_id_fkey" FOREIGN KEY ("program_day_id") REFERENCES "program_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_log_entries" ADD CONSTRAINT "workout_log_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercise_logs" ADD CONSTRAINT "workout_exercise_logs_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "workout_log_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_exercise_log_id_fkey" FOREIGN KEY ("exercise_log_id") REFERENCES "workout_exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_classes" ADD CONSTRAINT "group_classes_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_class_bookings" ADD CONSTRAINT "group_class_bookings_group_class_id_fkey" FOREIGN KEY ("group_class_id") REFERENCES "group_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_class_bookings" ADD CONSTRAINT "group_class_bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_slots" ADD CONSTRAINT "personal_slots_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_slots" ADD CONSTRAINT "personal_slots_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_slots" ADD CONSTRAINT "personal_slots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lockers" ADD CONSTRAINT "lockers_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lockers" ADD CONSTRAINT "lockers_rented_by_fkey" FOREIGN KEY ("rented_by") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_pricing" ADD CONSTRAINT "membership_pricing_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_posts" ADD CONSTRAINT "club_posts_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "club_post_media" ADD CONSTRAINT "club_post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "club_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_logs" ADD CONSTRAINT "cycle_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_writeoffs" ADD CONSTRAINT "stock_writeoffs_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_writeoffs" ADD CONSTRAINT "stock_writeoffs_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_entries" ADD CONSTRAINT "inventory_count_entries_inventory_count_id_fkey" FOREIGN KEY ("inventory_count_id") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_checklists" ADD CONSTRAINT "cleaning_checklists_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_checklist_items" ADD CONSTRAINT "cleaning_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "cleaning_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_messages" ADD CONSTRAINT "director_messages_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "director_messages" ADD CONSTRAINT "director_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_offers" ADD CONSTRAINT "report_offers_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log_entries" ADD CONSTRAINT "activity_log_entries_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_notes" ADD CONSTRAINT "outreach_notes_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_notes" ADD CONSTRAINT "outreach_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
