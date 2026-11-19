-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CHALLENGE_COMPLETED';

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "body" TEXT,
ADD COLUMN     "videoId" TEXT;
