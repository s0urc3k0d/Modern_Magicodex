-- DropIndex: Drop the old unique constraint
DROP INDEX IF EXISTS "user_list_items_userId_cardId_type_key";

-- CreateIndex: Create the new extended unique constraint
CREATE UNIQUE INDEX "user_list_items_userId_cardId_type_condition_language_isFoil_isSigned_isAltered_key" 
ON "user_list_items"("userId", "cardId", "type", "condition", "language", "isFoil", "isSigned", "isAltered");
