-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SYSADMIN';

-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "screenshot" BYTEA,
    "screenshot_mime" TEXT,
    "telemetry" JSONB NOT NULL,
    "status" "BugReportStatus" NOT NULL DEFAULT 'NEW',
    "resolution_note" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_reports_status_created_at_idx" ON "bug_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "bug_reports_reporter_id_created_at_idx" ON "bug_reports"("reporter_id", "created_at");

-- CreateIndex
CREATE INDEX "bug_reports_gym_id_created_at_idx" ON "bug_reports"("gym_id", "created_at");

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
