-- L: streak-break DM tracking
ALTER TABLE "User" ADD COLUMN "streakBrokenAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "streakBrokenNotified" BOOLEAN NOT NULL DEFAULT false;
