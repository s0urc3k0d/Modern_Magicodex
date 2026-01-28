-- Add priceEurFoil column to cards table and index it for faster queries
ALTER TABLE "cards" ADD COLUMN "priceEurFoil" REAL;

-- Create index for priceEurFoil
CREATE INDEX "cards_priceEurFoil_idx" ON "cards" ("priceEurFoil");
