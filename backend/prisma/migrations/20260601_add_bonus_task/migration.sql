-- CreateTable
CREATE TABLE "BonusTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 25,
    "provider" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BonusTask_userId_localDate_idx" ON "BonusTask"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "BonusTask_userId_localDate_key" ON "BonusTask"("userId", "localDate");

-- AddForeignKey
ALTER TABLE "BonusTask" ADD CONSTRAINT "BonusTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

