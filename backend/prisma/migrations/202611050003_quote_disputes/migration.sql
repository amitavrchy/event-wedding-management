ALTER TABLE "Booking" ADD COLUMN "quoteId" TEXT;
CREATE UNIQUE INDEX "Booking_quoteId_key" ON "Booking"("quoteId");
CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Dispute_bookingId_key" ON "Dispute"("bookingId");
