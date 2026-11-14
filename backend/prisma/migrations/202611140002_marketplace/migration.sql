-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "reply" TEXT,
ADD COLUMN     "reportReason" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "planCode" TEXT,
ADD COLUMN     "priceFromMinor" INTEGER,
ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "responseMinutes" INTEGER,
ADD COLUMN     "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VendorService" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "entitlements" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "proofMediaId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "receiptNumber" TEXT,
    "note" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "mediaIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "eventId" TEXT,
    "serviceId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "eventDate" TIMESTAMP(3),
    "guestCount" INTEGER,
    "budgetMinor" INTEGER,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "leadId" TEXT,
    "conversationId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "detail" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "Subscription_vendorId_status_idx" ON "Subscription"("vendorId", "status");

-- CreateIndex
CREATE INDEX "Subscription_status_endsAt_idx" ON "Subscription"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_receiptNumber_key" ON "SubscriptionPayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_status_createdAt_idx" ON "SubscriptionPayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_method_reference_key" ON "SubscriptionPayment"("method", "reference");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_createdAt_idx" ON "VerificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationRequest_vendorId_idx" ON "VerificationRequest"("vendorId");

-- CreateIndex
CREATE INDEX "Inquiry_vendorId_status_createdAt_idx" ON "Inquiry"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_hostId_createdAt_idx" ON "Inquiry"("hostId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Review_vendorId_status_createdAt_idx" ON "Review"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Vendor_status_category_city_idx" ON "Vendor"("status", "category", "city");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Starter plans (prices are editable by administrators).
INSERT INTO "Plan" ("id", "code", "name", "priceMinor", "periodDays", "entitlements", "active", "sortOrder") VALUES
  ('plan_standard', 'STANDARD', 'Standard', 150000, 30, '{"maxPhotos": 20, "maxServices": 10, "featured": false, "priority": 1}', true, 1),
  ('plan_premium', 'PREMIUM', 'Premium', 400000, 30, '{"maxPhotos": 50, "maxServices": 30, "featured": true, "priority": 2}', true, 2),
  ('plan_premium_year', 'PREMIUM_YEAR', 'Premium (yearly)', 4000000, 365, '{"maxPhotos": 50, "maxServices": 30, "featured": true, "priority": 2}', true, 3)
ON CONFLICT ("code") DO NOTHING;
