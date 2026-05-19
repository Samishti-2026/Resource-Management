/*
  Warnings:

  - You are about to drop the column `periodEnd` on the `Allocation` table. All the data in the column will be lost.
  - You are about to drop the column `periodStart` on the `Allocation` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[employeeId,projectId]` on the table `Allocation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `weekEnd` to the `Timesheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weekNumber` to the `Timesheet` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Allocation_employeeId_projectId_periodStart_key";

-- AlterTable
ALTER TABLE "Allocation" DROP COLUMN "periodEnd",
DROP COLUMN "periodStart";

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "weekEnd" DATE NOT NULL,
ADD COLUMN     "weekNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_employeeId_projectId_key" ON "Allocation"("employeeId", "projectId");
