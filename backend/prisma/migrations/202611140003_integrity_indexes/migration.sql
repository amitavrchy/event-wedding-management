-- CreateIndex
CREATE INDEX "AutomationRule_enabled_eventId_idx" ON "AutomationRule"("enabled", "eventId");

-- CreateIndex
CREATE INDEX "Booking_eventId_idx" ON "Booking"("eventId");

-- CreateIndex
CREATE INDEX "Booking_vendorId_idx" ON "Booking"("vendorId");

-- CreateIndex
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "ChecklistItem_eventId_idx" ON "ChecklistItem"("eventId");

-- CreateIndex
CREATE INDEX "ChecklistItem_done_dueAt_idx" ON "ChecklistItem"("done", "dueAt");

-- CreateIndex
CREATE INDEX "Contract_vendorId_idx" ON "Contract"("vendorId");

-- CreateIndex
CREATE INDEX "Contract_eventId_idx" ON "Contract"("eventId");

-- CreateIndex
CREATE INDEX "Event_hostId_idx" ON "Event"("hostId");

-- CreateIndex
CREATE INDEX "EventDay_eventId_idx" ON "EventDay"("eventId");

-- CreateIndex
CREATE INDEX "EventMember_userId_idx" ON "EventMember"("userId");

-- CreateIndex
CREATE INDEX "Expense_eventId_idx" ON "Expense"("eventId");

-- CreateIndex
CREATE INDEX "Guest_eventId_idx" ON "Guest"("eventId");

-- CreateIndex
CREATE INDEX "GuestCheckin_eventId_dayId_idx" ON "GuestCheckin"("eventId", "dayId");

-- CreateIndex
CREATE INDEX "Installment_bookingId_idx" ON "Installment"("bookingId");

-- CreateIndex
CREATE INDEX "Installment_status_dueAt_idx" ON "Installment"("status", "dueAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_vendorId_idx" ON "LedgerEntry"("vendorId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MoodItem_eventId_idx" ON "MoodItem"("eventId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_status_idx" ON "Payment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "Payment_eventId_idx" ON "Payment"("eventId");

-- CreateIndex
CREATE INDEX "Quote_eventId_idx" ON "Quote"("eventId");

-- CreateIndex
CREATE INDEX "Quote_status_expiresAt_idx" ON "Quote"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Vendor_ownerId_idx" ON "Vendor"("ownerId");

-- CreateIndex
CREATE INDEX "VendorMember_userId_idx" ON "VendorMember"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_scope_scopeId_idx" ON "WorkspaceInvite"("scope", "scopeId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;


-- Foreign keys above are NOT VALID: enforced for new and changed rows without
-- failing on historical orphans. After cleaning old data, run for each:
--   ALTER TABLE "<table>" VALIDATE CONSTRAINT "<name>";

-- Status values are constrained in the database (E-D3).
ALTER TABLE "Booking" ADD CONSTRAINT "booking_status_valid"
  CHECK ("status" IN ('HELD', 'AWAITING_ADVANCE', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED')) NOT VALID;
ALTER TABLE "Payment" ADD CONSTRAINT "payment_status_valid"
  CHECK ("status" IN ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED')) NOT VALID;
ALTER TABLE "Quote" ADD CONSTRAINT "quote_status_valid"
  CHECK ("status" IN ('SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED')) NOT VALID;
ALTER TABLE "Vendor" ADD CONSTRAINT "vendor_status_valid"
  CHECK ("status" IN ('APPLIED', 'ACTIVE', 'SUSPENDED')) NOT VALID;
ALTER TABLE "User" ADD CONSTRAINT "user_role_valid"
  CHECK ("role" IN ('HOST', 'VENDOR', 'PLATFORM_ADMIN')) NOT VALID;
ALTER TABLE "Subscription" ADD CONSTRAINT "subscription_status_valid"
  CHECK ("status" IN ('PENDING_PAYMENT', 'PENDING_REVIEW', 'ACTIVE', 'EXPIRED', 'CANCELLED')) NOT VALID;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "subscription_payment_status_valid"
  CHECK ("status" IN ('SUBMITTED', 'APPROVED', 'REJECTED')) NOT VALID;
ALTER TABLE "Review" ADD CONSTRAINT "review_status_valid"
  CHECK ("status" IN ('PUBLISHED', 'REPORTED', 'HIDDEN')) NOT VALID;
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "outbound_status_valid"
  CHECK ("status" IN ('PENDING', 'SENDING', 'SENT', 'FAILED')) NOT VALID;
