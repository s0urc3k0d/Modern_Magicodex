/*
  Warnings:

  - You are about to drop the `cards_fts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cards_fts_config` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cards_fts_content` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cards_fts_data` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cards_fts_docsize` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cards_fts_idx` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "cards_fts";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "cards_fts_config";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "cards_fts_content";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "cards_fts_data";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "cards_fts_docsize";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "cards_fts_idx";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scryfallId" TEXT NOT NULL,
    "oracleId" TEXT,
    "name" TEXT NOT NULL,
    "nameFr" TEXT,
    "manaCost" TEXT,
    "cmc" REAL,
    "typeLine" TEXT NOT NULL,
    "typeLineFr" TEXT,
    "oracleText" TEXT,
    "oracleTextFr" TEXT,
    "power" TEXT,
    "toughness" TEXT,
    "loyalty" TEXT,
    "colors" TEXT,
    "colorIdentity" TEXT,
    "rarity" TEXT NOT NULL,
    "collectorNumber" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'en',
    "imageUris" TEXT,
    "prices" TEXT,
    "legalities" TEXT,
    "booster" BOOLEAN,
    "promo" BOOLEAN,
    "variation" BOOLEAN,
    "fullArt" BOOLEAN,
    "frameEffects" TEXT,
    "promoTypes" TEXT,
    "borderColor" TEXT,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "setId" TEXT NOT NULL,
    CONSTRAINT "cards_setId_fkey" FOREIGN KEY ("setId") REFERENCES "sets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_cards" ("cmc", "collectorNumber", "colorIdentity", "colors", "createdAt", "id", "imageUris", "lang", "legalities", "loyalty", "manaCost", "name", "nameFr", "oracleId", "oracleText", "oracleTextFr", "power", "prices", "rarity", "scryfallId", "setId", "toughness", "typeLine", "typeLineFr", "updatedAt") SELECT "cmc", "collectorNumber", "colorIdentity", "colors", "createdAt", "id", "imageUris", "lang", "legalities", "loyalty", "manaCost", "name", "nameFr", "oracleId", "oracleText", "oracleTextFr", "power", "prices", "rarity", "scryfallId", "setId", "toughness", "typeLine", "typeLineFr", "updatedAt" FROM "cards";
DROP TABLE "cards";
ALTER TABLE "new_cards" RENAME TO "cards";
CREATE UNIQUE INDEX "cards_scryfallId_key" ON "cards"("scryfallId");
CREATE INDEX "cards_setId_collectorNumber_idx" ON "cards"("setId", "collectorNumber");
CREATE INDEX "cards_oracleId_idx" ON "cards"("oracleId");
CREATE INDEX "cards_setId_idx" ON "cards"("setId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
