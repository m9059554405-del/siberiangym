-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('CASH', 'CARD_ONLINE');

-- CreateEnum
CREATE TYPE "OrderLineType" AS ENUM ('MEMBERSHIP_PURCHASE', 'MEMBERSHIP_RENEWAL', 'TARIFF_CHANGE', 'STOCK_PURCHASE', 'LOCKER_RENTAL', 'GROUP_CLASS_BOOKING', 'PERSONAL_SLOT_BOOKING');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "order_id" TEXT;

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_method" "OrderPaymentMethod",
    "total_amount" INTEGER NOT NULL,
    "receipt_raw" TEXT,
    "receipt_date" TIMESTAMP(3),
    "receipt_fn" TEXT,
    "receipt_i" TEXT,
    "receipt_fp" TEXT,
    "expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" "OrderLineType" NOT NULL,
    "ref_id" TEXT,
    "amount" INTEGER NOT NULL,
    "meta" JSONB,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_gym_id_idx" ON "orders"("gym_id");

-- CreateIndex
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_receipt_fn_receipt_i_receipt_fp_key" ON "orders"("receipt_fn", "receipt_i", "receipt_fp");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
