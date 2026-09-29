-- Final payment model: COD + JazzCash, stock is never reserved.
-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'ABANDONED';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('COD', 'JAZZCASH');
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PAID', 'REFUND_NEEDED', 'REFUNDED');
ALTER TABLE "public"."Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StockMovementReason_new" AS ENUM ('IMPORT', 'ADMIN_ADJUST', 'SALE', 'ORDER_CANCELLED');
ALTER TABLE "StockMovement" ALTER COLUMN "reason" TYPE "StockMovementReason_new" USING ("reason"::text::"StockMovementReason_new");
ALTER TYPE "StockMovementReason" RENAME TO "StockMovementReason_old";
ALTER TYPE "StockMovementReason_new" RENAME TO "StockMovementReason";
DROP TYPE "public"."StockMovementReason_old";
COMMIT;

-- DropIndex
DROP INDEX "Order_status_reservedUntil_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "reservedUntil",
ADD COLUMN     "stockDeductedAt" TIMESTAMP(3),
ALTER COLUMN "orderNumber" SET DEFAULT (nextval('order_number_seq'))::text;

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

