-- D1: streak-freeze (Premium restore counters)
ALTER TABLE "User" ADD COLUMN "streakFreezesLeft" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "User" ADD COLUMN "streakFreezesMonth" TEXT;
ALTER TABLE "User" ADD COLUMN "streakFreezeDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- D5: referral anti-abuse — inviter rewarded only after invitee's first done task
ALTER TABLE "User" ADD COLUMN "referralRewarded" BOOLEAN NOT NULL DEFAULT false;
-- Backfill: existing referred users keep their already-paid reward, so mark them rewarded
UPDATE "User" SET "referralRewarded" = true WHERE "referredById" IS NOT NULL;

-- D2: leagues
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "weekStart" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "League_weekStart_tier_idx" ON "League"("weekStart", "tier");

CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weeklyXp" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeagueMember_leagueId_userId_key" ON "LeagueMember"("leagueId", "userId");
CREATE INDEX "LeagueMember_userId_idx" ON "LeagueMember"("userId");
CREATE INDEX "LeagueMember_leagueId_weeklyXp_idx" ON "LeagueMember"("leagueId", "weeklyXp");

ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
