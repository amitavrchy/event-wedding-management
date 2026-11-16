-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "householdId" TEXT,
ADD COLUMN     "invitationOpenedAt" TIMESTAMP(3),
ADD COLUMN     "invitationSentAt" TIMESTAMP(3),
ADD COLUMN     "relationship" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "side" TEXT;

-- AlterTable
ALTER TABLE "RunSheetItem" ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "side" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "token" TEXT NOT NULL,
    "invitationSentAt" TIMESTAMP(3),
    "invitationOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT,
    "householdId" TEXT,
    "giverName" TEXT NOT NULL,
    "side" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'CASH',
    "amountMinor" INTEGER,
    "description" TEXT,
    "dayId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "thankYouSentAt" TIMESTAMP(3),
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accommodation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "rooms" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "contact" TEXT,
    "notes" TEXT,

    CONSTRAINT "Accommodation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "departAt" TIMESTAMP(3),
    "route" TEXT,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestTravel" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "accommodationId" TEXT,
    "transportId" TEXT,
    "arrivalAt" TIMESTAMP(3),
    "departureAt" TIMESTAMP(3),
    "fromCity" TEXT,
    "notes" TEXT,

    CONSTRAINT "GuestTravel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationCard" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dayId" TEXT,
    "template" TEXT NOT NULL DEFAULT 'MARIGOLD',
    "language" TEXT NOT NULL DEFAULT 'bn',
    "headline" TEXT NOT NULL,
    "hostLine" TEXT,
    "message" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestPhoto" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploaderName" TEXT,
    "caption" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorDayLink" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "arrivedDayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorDayLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Household_token_key" ON "Household"("token");

-- CreateIndex
CREATE INDEX "Household_eventId_idx" ON "Household"("eventId");

-- CreateIndex
CREATE INDEX "Gift_eventId_receivedAt_idx" ON "Gift"("eventId", "receivedAt");

-- CreateIndex
CREATE INDEX "Accommodation_eventId_idx" ON "Accommodation"("eventId");

-- CreateIndex
CREATE INDEX "Transport_eventId_idx" ON "Transport"("eventId");

-- CreateIndex
CREATE INDEX "GuestTravel_accommodationId_idx" ON "GuestTravel"("accommodationId");

-- CreateIndex
CREATE INDEX "GuestTravel_transportId_idx" ON "GuestTravel"("transportId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestTravel_eventId_guestId_key" ON "GuestTravel"("eventId", "guestId");

-- CreateIndex
CREATE INDEX "InvitationCard_eventId_idx" ON "InvitationCard"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestPhoto_mediaId_key" ON "GuestPhoto"("mediaId");

-- CreateIndex
CREATE INDEX "GuestPhoto_eventId_status_createdAt_idx" ON "GuestPhoto"("eventId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendorDayLink_token_key" ON "VendorDayLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VendorDayLink_eventId_vendorId_key" ON "VendorDayLink"("eventId", "vendorId");

-- CreateIndex
CREATE INDEX "Guest_householdId_idx" ON "Guest"("householdId");

