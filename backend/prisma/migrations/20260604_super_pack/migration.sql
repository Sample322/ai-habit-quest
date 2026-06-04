-- Combined: LL habit weekly schedule + NN per-habit reminders + RR showcase
-- + TT AI coaching style + UU last AI review timestamp.

-- LL: weekly schedule bitmask. 127 = bit0..bit6 set = all 7 days
ALTER TABLE "Habit" ADD COLUMN "scheduleMask" INTEGER NOT NULL DEFAULT 127;

-- NN: per-habit reminders
ALTER TABLE "Habit" ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Habit" ADD COLUMN "reminderHour" INTEGER;
ALTER TABLE "Habit" ADD COLUMN "reminderMinute" INTEGER;

-- RR: up to 3 favourite achievement codes
ALTER TABLE "User" ADD COLUMN "showcaseAchievements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- TT: AI coaching style override (gentle | strict | humor | NULL)
ALTER TABLE "User" ADD COLUMN "aiCoachingStyle" TEXT;

-- UU: dedupe weekly AI review DM
ALTER TABLE "User" ADD COLUMN "lastAiReviewAt" TIMESTAMP(3);
