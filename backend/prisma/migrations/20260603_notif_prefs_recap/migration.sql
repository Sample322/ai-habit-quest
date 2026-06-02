-- U: per-channel notification preferences
ALTER TABLE "User" ADD COLUMN "notifReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifAchievements" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifSeasons" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifStreakBreak" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "notifWeeklyRecap" BOOLEAN NOT NULL DEFAULT true;

-- T: weekly recap dedupe
ALTER TABLE "User" ADD COLUMN "lastRecapAt" TIMESTAMP(3);
