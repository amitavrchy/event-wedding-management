CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Booking" ADD CONSTRAINT "booking_service_period_exclusion"
EXCLUDE USING gist ("serviceId" WITH =, tsrange("startAt", "reservedUntil", '[)') WITH &&)
WHERE ("status" IN ('HELD', 'AWAITING_ADVANCE', 'CONFIRMED'));
ALTER TABLE "Booking" ADD CONSTRAINT "booking_money_valid" CHECK ("priceMinor" >= 0 AND "advanceMinor" >= 0 AND "advanceMinor" <= "priceMinor");
ALTER TABLE "Booking" ADD CONSTRAINT "booking_period_valid" CHECK ("startAt" < "endAt" AND "endAt" <= "reservedUntil");
ALTER TABLE "Payment" ADD CONSTRAINT "payment_amount_valid" CHECK ("amountMinor" > 0);
ALTER TABLE "Guest" ADD CONSTRAINT "guest_party_valid" CHECK ("partySize" >= 1 AND "partySize" <= "maxPartySize" AND "maxPartySize" <= 10);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "ledger_conserves_money" CHECK ("grossMinor" = "commissionMinor" + "netMinor" AND "commissionMinor" >= 0 AND "netMinor" >= 0);
ALTER TABLE "Review" ADD CONSTRAINT "review_rating_valid" CHECK ("rating" BETWEEN 1 AND 5);
