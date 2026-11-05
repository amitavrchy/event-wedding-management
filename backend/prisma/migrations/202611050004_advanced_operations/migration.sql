-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "dietaryNotes" TEXT,
ADD COLUMN     "groupName" TEXT NOT NULL DEFAULT 'Friends',
ADD COLUMN     "seatingTableId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "installmentId" TEXT;

-- CreateTable
CREATE TABLE "EventMember" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'EDITOR',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorMember" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'MANAGER',
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "memberExpiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatTable" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "shape" TEXT NOT NULL DEFAULT 'ROUND',
    "x" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SeatTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunSheetItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RunSheetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "signedBy" TEXT,
    "signerName" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "eventDate" TIMESTAMP(3),
    "estimatedMinor" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL DEFAULT 7,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventWebsite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "story" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'ROSE',
    "faqs" JSONB NOT NULL,
    "passwordHash" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestbookEntry" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestbookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "tag" TEXT NOT NULL DEFAULT 'Inspiration',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "vendorId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestCheckin" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "checkedInBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestResponse" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "GuestResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventMember_eventId_userId_key" ON "EventMember"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorMember_vendorId_userId_key" ON "VendorMember"("vendorId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SeatTable_eventId_label_key" ON "SeatTable"("eventId", "label");

-- CreateIndex
CREATE INDEX "RunSheetItem_eventId_startsAt_idx" ON "RunSheetItem"("eventId", "startsAt");

-- CreateIndex
CREATE INDEX "Installment_eventId_dueAt_idx" ON "Installment"("eventId", "dueAt");

-- CreateIndex
CREATE INDEX "Lead_vendorId_stage_idx" ON "Lead"("vendorId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_key_key" ON "AutomationRun"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EventWebsite_eventId_key" ON "EventWebsite"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventWebsite_slug_key" ON "EventWebsite"("slug");

-- CreateIndex
CREATE INDEX "GuestbookEntry_websiteId_approved_idx" ON "GuestbookEntry"("websiteId", "approved");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_vendorId_key" ON "Favorite"("userId", "vendorId");

-- CreateIndex
CREATE INDEX "Activity_eventId_createdAt_idx" ON "Activity"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_vendorId_createdAt_idx" ON "Activity"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestCheckin_dayId_guestId_key" ON "GuestCheckin"("dayId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestResponse_guestId_dayId_key" ON "GuestResponse"("guestId", "dayId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- AddForeignKey
ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorMember" ADD CONSTRAINT "VendorMember_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
