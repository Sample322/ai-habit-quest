-- D: Seasons + SeasonResult

CREATE TYPE "SeasonStatus" AS ENUM ('active', 'closed');

CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");
CREATE INDEX "Season_status_idx" ON "Season"("status");

CREATE TABLE "SeasonResult" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonalXp" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER NOT NULL,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,
    "rewardKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonResult_seasonId_userId_key" ON "SeasonResult"("seasonId", "userId");
CREATE INDEX "SeasonResult_userId_idx" ON "SeasonResult"("userId");
CREATE INDEX "SeasonResult_seasonId_finalRank_idx" ON "SeasonResult"("seasonId", "finalRank");

ALTER TABLE "SeasonResult" ADD CONSTRAINT "SeasonResult_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonResult" ADD CONSTRAINT "SeasonResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
