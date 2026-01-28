-- FTS5 table for fast card text search
CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
  cardId UNINDEXED,
  name,
  nameFr,
  typeLine,
  typeLineFr,
  oracleText,
  oracleTextFr,
  tokenize = 'porter'
);

-- Triggers to keep FTS up to date
CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
  INSERT INTO cards_fts (cardId, name, nameFr, typeLine, typeLineFr, oracleText, oracleTextFr)
  VALUES (new.id, new.name, new.nameFr, new.typeLine, new.typeLineFr, new.oracleText, new.oracleTextFr);
END;

CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
  DELETE FROM cards_fts WHERE cardId = old.id;
  INSERT INTO cards_fts (cardId, name, nameFr, typeLine, typeLineFr, oracleText, oracleTextFr)
  VALUES (new.id, new.name, new.nameFr, new.typeLine, new.typeLineFr, new.oracleText, new.oracleTextFr);
END;

CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
  DELETE FROM cards_fts WHERE cardId = old.id;
END;

-- Backfill from existing cards
DELETE FROM cards_fts;
INSERT INTO cards_fts (cardId, name, nameFr, typeLine, typeLineFr, oracleText, oracleTextFr)
SELECT id, name, nameFr, typeLine, typeLineFr, oracleText, oracleTextFr FROM cards;
