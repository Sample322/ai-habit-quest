-- Free 3-day trial (claim once per account, no card)
ALTER TABLE "User" ADD COLUMN "trialClaimedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "trialReminderSent" BOOLEAN NOT NULL DEFAULT false;
