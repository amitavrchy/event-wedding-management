-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "livestreamUrl" TEXT,
ADD COLUMN     "photoWallModeration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "photoWallToken" TEXT,
ADD COLUMN     "sides" JSONB;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paidBy" TEXT,
ADD COLUMN     "receiptMediaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Event_photoWallToken_key" ON "Event"("photoWallToken");

