-- Referral 2.0: invitee welcome gift + one-time reminder flag.
ALTER TABLE "User" ADD COLUMN "referralGiftClaimedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "referralGiftReminderSent" BOOLEAN NOT NULL DEFAULT false;
