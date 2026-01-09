-- AlterTable
ALTER TABLE "LoanPayment" ADD COLUMN     "date_paid" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "reference" TEXT NOT NULL DEFAULT '';
