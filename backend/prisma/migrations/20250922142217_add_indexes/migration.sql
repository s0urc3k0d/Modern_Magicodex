-- CreateIndex
CREATE INDEX "cards_oracleId_idx" ON "cards"("oracleId");

-- CreateIndex
CREATE INDEX "cards_setId_idx" ON "cards"("setId");

-- CreateIndex
CREATE INDEX "deck_cards_deckId_idx" ON "deck_cards"("deckId");

-- CreateIndex
CREATE INDEX "deck_cards_cardId_idx" ON "deck_cards"("cardId");

-- CreateIndex
CREATE INDEX "user_cards_userId_idx" ON "user_cards"("userId");

-- CreateIndex
CREATE INDEX "user_cards_cardId_idx" ON "user_cards"("cardId");
