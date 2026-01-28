-- Add priceEur column to cards table and index it for faster sorting/filtering
ALTER TABLE "cards" ADD COLUMN "priceEur" REAL;

-- Create index for priceEur
CREATE INDEX "cards_priceEur_idx" ON "cards" ("priceEur");
