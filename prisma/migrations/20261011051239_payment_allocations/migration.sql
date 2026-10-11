-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_studentFeeId_fkey";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "studentFeeId";

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "studentFeeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_studentFeeId_idx" ON "PaymentAllocation"("studentFeeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFee_enrollmentId_period_key" ON "StudentFee"("enrollmentId", "period");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_studentFeeId_fkey" FOREIGN KEY ("studentFeeId") REFERENCES "StudentFee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Money integrity checks (not expressible in the Prisma schema).
ALTER TABLE "StudentFee" ADD CONSTRAINT "StudentFee_amounts_check"
  CHECK ("amount" >= 0 AND "discount" >= 0 AND "discount" <= "amount"
         AND "paidAmount" >= 0 AND "paidAmount" <= "amount" - "discount");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_sign_check"
  CHECK (("type" = 'PAYMENT' AND "amount" > 0 AND "reversalOfId" IS NULL)
      OR ("type" = 'REVERSAL' AND "amount" < 0 AND "reversalOfId" IS NOT NULL));

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_check" CHECK ("amount" <> 0);

ALTER TABLE "Batch" ADD CONSTRAINT "Batch_money_check"
  CHECK (("monthlyFee" IS NULL OR "monthlyFee" >= 0) AND ("capacity" IS NULL OR "capacity" > 0));

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_discount_check" CHECK ("discount" >= 0);

ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_amount_check" CHECK ("amount" >= 0);
