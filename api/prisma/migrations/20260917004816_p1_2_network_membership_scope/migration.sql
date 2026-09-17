-- CreateEnum
CREATE TYPE "MembershipScope" AS ENUM ('SINGLE_GYM', 'NETWORK');

-- AlterTable
ALTER TABLE "membership_pricing" ADD COLUMN     "monthly_network" INTEGER,
ADD COLUMN     "pack10_network" INTEGER,
ADD COLUMN     "pack20_network" INTEGER,
ADD COLUMN     "single_network" INTEGER;

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "scope" "MembershipScope" NOT NULL DEFAULT 'SINGLE_GYM';
