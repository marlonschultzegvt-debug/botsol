-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GenerationType" ADD VALUE 'CAROUSEL_ART';
ALTER TYPE "GenerationType" ADD VALUE 'IMAGE';
ALTER TYPE "GenerationType" ADD VALUE 'REEL';
ALTER TYPE "GenerationType" ADD VALUE 'JARVIS';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "brandAccent" TEXT,
ADD COLUMN     "brandBg" TEXT,
ADD COLUMN     "brandFont" TEXT,
ADD COLUMN     "brandPrimary" TEXT,
ADD COLUMN     "brandText" TEXT,
ADD COLUMN     "logoAssetId" TEXT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'upload';

-- AlterTable
ALTER TABLE "AiGeneration" ADD COLUMN     "assetIds" TEXT[],
ADD COLUMN     "costUsd" DECIMAL(10,4),
ADD COLUMN     "provider" TEXT;

