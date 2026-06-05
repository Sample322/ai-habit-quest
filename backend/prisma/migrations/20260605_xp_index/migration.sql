-- Add index on User.xpTotal for fast leaderboard ORDER BY / COUNT WHERE.
CREATE INDEX "User_xpTotal_idx" ON "User"("xpTotal");
