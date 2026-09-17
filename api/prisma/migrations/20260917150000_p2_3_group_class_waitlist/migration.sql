-- CreateTable
CREATE TABLE "group_class_waitlist" (
    "id" TEXT NOT NULL,
    "group_class_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified_at" TIMESTAMP(3),

    CONSTRAINT "group_class_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_class_waitlist_group_class_id_joined_at_idx" ON "group_class_waitlist"("group_class_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "group_class_waitlist_group_class_id_client_id_key" ON "group_class_waitlist"("group_class_id", "client_id");

-- AddForeignKey
ALTER TABLE "group_class_waitlist" ADD CONSTRAINT "group_class_waitlist_group_class_id_fkey" FOREIGN KEY ("group_class_id") REFERENCES "group_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_class_waitlist" ADD CONSTRAINT "group_class_waitlist_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
