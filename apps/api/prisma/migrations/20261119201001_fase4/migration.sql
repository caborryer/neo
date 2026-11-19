-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RiskFollowUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "reasons" TEXT[],
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskFollowUp_userId_createdAt_idx" ON "RiskFollowUp"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RiskFollowUp" ADD CONSTRAINT "RiskFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskFollowUp" ADD CONSTRAINT "RiskFollowUp_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
