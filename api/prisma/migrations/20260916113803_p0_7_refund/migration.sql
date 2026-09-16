-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('AWAITING_RECEIPT', 'CONFIRMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TransactionCategory" ADD VALUE 'REFUND';

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'AWAITING_RECEIPT',
    "receipt_raw" TEXT,
    "receipt_date" TIMESTAMP(3),
    "receipt_fn" TEXT,
    "receipt_i" TEXT,
    "receipt_fp" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_lines" (
    "id" TEXT NOT NULL,
    "refund_id" TEXT NOT NULL,
    "order_line_id" TEXT NOT NULL,
    "detail" TEXT NOT NULL,

    CONSTRAINT "refund_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refunds_gym_id_idx" ON "refunds"("gym_id");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_receipt_fn_receipt_i_receipt_fp_key" ON "refunds"("receipt_fn", "receipt_i", "receipt_fp");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_lines" ADD CONSTRAINT "refund_lines_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
