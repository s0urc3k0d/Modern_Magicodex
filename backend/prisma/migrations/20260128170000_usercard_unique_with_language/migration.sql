-- DropIndex: Remove the old unique constraint on (userId, cardId)
DROP INDEX IF EXISTS "user_cards_userId_cardId_key";

-- CreateIndex: Add new unique constraint that includes language
CREATE UNIQUE INDEX "user_cards_userId_cardId_language_key" ON "user_cards"("userId", "cardId", "language");
