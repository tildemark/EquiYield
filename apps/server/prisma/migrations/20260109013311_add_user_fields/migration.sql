/*
  Warnings:

  - You are about to drop the column `is_dividend_eligible` on the `User` table. All the data in the column will be lost.
  - Added the required column `borrowerEmail` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `borrowerName` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `borrowerPhone` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `borrowerType` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dueDate` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `monthlyAmortization` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `monthlyRateBps` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termMonths` to the `Loan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BorrowerType" AS ENUM ('MEMBER', 'NON_MEMBER');

-- CreateEnum
CREATE TYPE "DepositChannel" AS ENUM ('GCASH', 'BANK');

-- DropForeignKey
ALTER TABLE "Loan" DROP CONSTRAINT "Loan_userId_fkey";

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "borrowerEmail" TEXT NOT NULL,
ADD COLUMN     "borrowerName" TEXT NOT NULL,
ADD COLUMN     "borrowerPhone" TEXT NOT NULL,
ADD COLUMN     "borrowerType" "BorrowerType" NOT NULL,
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "monthlyAmortization" INTEGER NOT NULL,
ADD COLUMN     "monthlyRateBps" INTEGER NOT NULL,
ADD COLUMN     "termMonths" INTEGER NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "is_dividend_eligible",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "bankAccountNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "full_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gcashNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "phone_number" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "max_loan_amount" INTEGER NOT NULL DEFAULT 100000,
ADD COLUMN     "min_loan_amount" INTEGER NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "ArchiveRun" (
    "id" SERIAL NOT NULL,
    "performedByUserId" INTEGER,
    "year" INTEGER NOT NULL,
    "purgedContributions" INTEGER NOT NULL DEFAULT 0,
    "purgedLoans" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanCoMaker" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanCoMaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleDividendEligibility" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "cycle" INTEGER NOT NULL,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleDividendEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DividendPayout" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdByUserId" INTEGER,
    "year" INTEGER NOT NULL,
    "perShare" DOUBLE PRECISION NOT NULL,
    "sharesCount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "channel" "DepositChannel" NOT NULL,
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccountNumber" TEXT NOT NULL DEFAULT '',
    "gcashNumber" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "depositedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DividendPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanCoMaker_loanId_userId_key" ON "LoanCoMaker"("loanId", "userId");

-- CreateIndex
CREATE INDEX "CycleDividendEligibility_year_cycle_idx" ON "CycleDividendEligibility"("year", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "CycleDividendEligibility_userId_year_cycle_key" ON "CycleDividendEligibility"("userId", "year", "cycle");

-- CreateIndex
CREATE INDEX "DividendPayout_year_idx" ON "DividendPayout"("year");

-- CreateIndex
CREATE UNIQUE INDEX "DividendPayout_userId_year_key" ON "DividendPayout"("userId", "year");

-- AddForeignKey
ALTER TABLE "ArchiveRun" ADD CONSTRAINT "ArchiveRun_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanCoMaker" ADD CONSTRAINT "LoanCoMaker_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanCoMaker" ADD CONSTRAINT "LoanCoMaker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleDividendEligibility" ADD CONSTRAINT "CycleDividendEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendPayout" ADD CONSTRAINT "DividendPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DividendPayout" ADD CONSTRAINT "DividendPayout_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
