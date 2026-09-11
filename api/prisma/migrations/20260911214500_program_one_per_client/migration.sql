-- DropIndex
DROP INDEX "programs_client_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "programs_client_id_key" ON "programs"("client_id");
