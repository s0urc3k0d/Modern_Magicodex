-- Add cached validation fields to decks table
ALTER TABLE "decks" ADD COLUMN "lastValidationAt" TIMESTAMP;
ALTER TABLE "decks" ADD COLUMN "lastValidationValid" BOOLEAN;
ALTER TABLE "decks" ADD COLUMN "lastValidationIssues" JSONB;
