-- CreateTable
CREATE TABLE "user_list_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    CONSTRAINT "user_list_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_list_items_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_list_items_userId_idx" ON "user_list_items"("userId");

-- CreateIndex
CREATE INDEX "user_list_items_cardId_idx" ON "user_list_items"("cardId");

-- CreateIndex
CREATE INDEX "user_list_items_type_idx" ON "user_list_items"("type");

-- CreateIndex
CREATE UNIQUE INDEX "user_list_items_userId_cardId_type_key" ON "user_list_items"("userId", "cardId", "type");
