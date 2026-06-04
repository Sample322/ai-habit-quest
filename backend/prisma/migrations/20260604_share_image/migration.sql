-- AA-2: ShareImage table for hosting Telegram-stories share PNGs.
CREATE TABLE "ShareImage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/png',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShareImage_createdAt_idx" ON "ShareImage"("createdAt");
