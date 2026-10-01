-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('OWN', 'COURIER');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('PLACED', 'PAID', 'REFUND_NEEDED', 'STATUS_CHANGED', 'SHIPPING_UPDATED', 'CANCELLED', 'REFUNDED', 'ABANDONED', 'NOTE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courier" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryMethod" "DeliveryMethod",
ADD COLUMN     "riderInfo" TEXT,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingNumber" TEXT;

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" "OrderEventType" NOT NULL,
    "message" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

