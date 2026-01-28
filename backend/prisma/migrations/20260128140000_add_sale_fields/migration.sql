-- Add FORSALE to ListType enum
ALTER TYPE "ListType" ADD VALUE 'FORSALE';

-- Add sale-related fields to user_cards
ALTER TABLE "user_cards" ADD COLUMN "isSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_cards" ADD COLUMN "isAltered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_cards" ADD COLUMN "isFirstEd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_cards" ADD COLUMN "forSale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_cards" ADD COLUMN "forSaleQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_cards" ADD COLUMN "forSaleFoil" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_cards" ADD COLUMN "askingPrice" DOUBLE PRECISION;
ALTER TABLE "user_cards" ADD COLUMN "askingPriceFoil" DOUBLE PRECISION;

-- Add sale-related fields to user_list_items
ALTER TABLE "user_list_items" ADD COLUMN "condition" TEXT NOT NULL DEFAULT 'NM';
ALTER TABLE "user_list_items" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "user_list_items" ADD COLUMN "isFoil" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_list_items" ADD COLUMN "isSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_list_items" ADD COLUMN "isAltered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_list_items" ADD COLUMN "askingPrice" DOUBLE PRECISION;

-- Add indexes for sale queries
CREATE INDEX "user_cards_forSale_idx" ON "user_cards"("forSale");
CREATE INDEX "user_list_items_type_idx" ON "user_list_items"("type");
